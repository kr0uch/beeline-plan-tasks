package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

const (
	earthRadiusKm    = 6371.0
	roadDetourFactor = 1.3
	defaultSpeedKmH  = 30.0
)

type GeoRepository interface {
	GetDistanceAndTravelTime(
		ctx context.Context,
		request *dto.GetDistanceAndTravelTimeRequest,
	) (*dto.GetDistanceAndTravelTimeResponse, error)
	GetDistanceAndTravelTimeHaversine(
		ctx context.Context,
		request *dto.GetDistanceAndTravelTimeRequest,
	) (*dto.GetDistanceAndTravelTimeResponse, error)
	BatchGetGeoDataByAddresses(
		ctx context.Context,
		addresses []string,
	) (dto.BatchGeoDataByAddressResponse, error)
}

type geoRepo struct {
	client  *http.Client
	baseURL string
	apiKey  string
}

func NewGeoRepository(
	client *http.Client,
	apiKey string,
) GeoRepository {
	return &geoRepo{
		client:  client,
		baseURL: "https://api.geoapify.com/v1",
		apiKey:  apiKey,
	}
}

func CalculateHaversine(lat1, lon1, lat2, lon2 float64, speedKmH float64) (float64, int) {
	if lat1 == lat2 && lon1 == lon2 {
		return 0.0, 0
	}

	radLat1 := lat1 * math.Pi / 180.0
	radLat2 := lat2 * math.Pi / 180.0
	dLat := (lat2 - lat1) * math.Pi / 180.0
	dLon := (lon2 - lon1) * math.Pi / 180.0

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(radLat1)*math.Cos(radLat2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	directDistance := earthRadiusKm * c

	roadDistance := directDistance * roadDetourFactor

	if speedKmH <= 0 {
		speedKmH = defaultSpeedKmH
	}

	travelTimeMin := (roadDistance / speedKmH) * 60.0

	return math.Round(roadDistance*100) / 100, int(math.Round(travelTimeMin))
}

func (r *geoRepo) GetDistanceAndTravelTimeHaversine(
	ctx context.Context,
	request *dto.GetDistanceAndTravelTimeRequest,
) (*dto.GetDistanceAndTravelTimeResponse, error) {
	dist, travelTime := CalculateHaversine(
		request.CurrentLat,
		request.CurrentLon,
		request.TargetLat,
		request.TargetLon,
		defaultSpeedKmH,
	)

	return &dto.GetDistanceAndTravelTimeResponse{
		Distance: dist,
		Time:     travelTime,
	}, nil
}

func (r *geoRepo) BatchGetGeoDataByAddresses(
	ctx context.Context,
	addresses []string,
) (dto.BatchGeoDataByAddressResponse, error) {

	if len(addresses) == 0 {
		return make(dto.BatchGeoDataByAddressResponse), nil
	}

	formattedAddresses := make([]string, len(addresses))
	addressMap := make(map[int]string)

	for i, rawAddr := range addresses {
		parsed := r.parseAddress(rawAddr)
		formattedAddresses[i] = fmt.Sprintf("%s, %s, %s", parsed.City, parsed.Street, parsed.HouseNumber)
		addressMap[i] = rawAddr
	}

	bodyBytes, err := json.Marshal(formattedAddresses)
	if err != nil {
		return nil, errors.ErrInvalidRequest
	}

	URLPath := fmt.Sprintf("%s/batch/geocode/search?apiKey=%s", r.baseURL, r.apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, URLPath, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return nil, errors.ErrInvalidRequest
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.client.Do(req)
	if err != nil {
		return nil, errors.ErrExternalService(err.Error())
	}
	defer resp.Body.Close()

	var responseBody []byte

	if resp.StatusCode == http.StatusOK {
		responseBody, err = io.ReadAll(resp.Body)
		if err != nil {
			return nil, errors.ErrExternalService(err.Error())
		}
	} else if resp.StatusCode == http.StatusAccepted {
		var jobResp struct {
			ID string `json:"id"`
		}
		if err = json.NewDecoder(resp.Body).Decode(&jobResp); err != nil {
			return nil, errors.ErrExternalService(err.Error())
		}

		responseBody, err = r.pollBatchResult(ctx, jobResp.ID)
		if err != nil {
			return nil, err
		}
	} else {
		return nil, errors.ErrExternalService(resp.Status)
	}

	return r.parseBatchGeocodeResponse(responseBody, addressMap)
}

func (r *geoRepo) pollBatchResult(ctx context.Context, jobID string) ([]byte, error) {
	pollURL := fmt.Sprintf("%s/batch/geocode/search?id=%s&apiKey=%s", r.baseURL, jobID, r.apiKey)

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-ticker.C:
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, pollURL, nil)
			if err != nil {
				return nil, err
			}

			resp, err := r.client.Do(req)
			if err != nil {
				return nil, errors.ErrExternalService(err.Error())
			}

			if resp.StatusCode == http.StatusOK {
				defer resp.Body.Close()
				return io.ReadAll(resp.Body)
			}
			resp.Body.Close()
		}
	}
}

func (r *geoRepo) parseBatchGeocodeResponse(
	jsonData []byte,
	addressMap map[int]string,
) (dto.BatchGeoDataByAddressResponse, error) {

	var items []dto.BatchGeocodeItem
	if err := json.Unmarshal(jsonData, &items); err != nil {
		return nil, errors.ErrDecodeResponse(err.Error())
	}

	resMap := make(dto.BatchGeoDataByAddressResponse, len(items))

	for i, item := range items {
		rawAddr, ok := addressMap[i]
		if !ok || rawAddr == "" {
			continue
		}

		isCorrectType := item.ResultType == "street" || item.ResultType == "building"
		hasStreetConfidence := item.Rank.ConfidenceStreetLevel >= 0.7
		hasValidConfidence := item.Rank.Confidence >= 0.5

		if isCorrectType && hasStreetConfidence && hasValidConfidence && (item.Lat != 0 || item.Lon != 0) {
			resMap[rawAddr] = entities.GeoData{
				Lat: item.Lat,
				Lon: item.Lon,
			}
		}
	}

	return resMap, nil
}

func (r *geoRepo) parseAddress(
	address string,
) *dto.Address {

	addr := &dto.Address{}
	remaining := address

	reHouse := regexp.MustCompile(`(?i)(?:^|\s|,)\s*(?:д\.|д\s)\s*(.*)$`)
	if match := reHouse.FindStringSubmatch(remaining); len(match) > 1 {
		house := strings.TrimSpace(match[1])

		reKorpus := regexp.MustCompile(`(?i)^([0-9А-Яа-яЁёA-Za-z\/\-]+?)\s*(?:,)?\s*(?:к|корп|корпус)\.?\s*(\d+)`)
		addr.HouseNumber = reKorpus.ReplaceAllString(house, "$1 к$2")

		remaining = strings.Replace(remaining, match[0], "", 1)
	}

	markers := `ул|пр-кт|пер|б-р|проезд|пр-зд|ш|наб`
	reStreet := regexp.MustCompile(`(?i)((?:` + markers + `)\.?[ \t]*[А-Яа-яЁёA-Za-z0-9\-]+(?:[ \t]+[А-Яа-яЁёA-Za-z0-9\-]+)*|[А-Яа-яЁёA-Za-z0-9\-]+(?:[ \t]+[А-Яа-яЁёA-Za-z0-9\-]+)*[ \t]+(?:` + markers + `)\.?)`)

	if match := reStreet.FindStringSubmatch(remaining); len(match) > 1 {
		fullStreet := strings.TrimSpace(match[1])
		remaining = strings.Replace(remaining, match[0], "", 1)

		rePrefix := regexp.MustCompile(`(?i)^(` + markers + `)\.?\s*`)
		reSuffix := regexp.MustCompile(`(?i)\s+(` + markers + `)\.?$`)

		cleanStreet := rePrefix.ReplaceAllString(fullStreet, "")
		cleanStreet = reSuffix.ReplaceAllString(cleanStreet, "")

		addr.Street = cleanStreet
	}

	reCityExplicit := regexp.MustCompile(`(?i)(?:г\.\s*город\s+|г\.\s*|город\s+|г\s+)([А-Яа-яЁё\-]+(?:\s+[А-Яа-яЁё\-]+)*)`)
	if match := reCityExplicit.FindStringSubmatch(remaining); len(match) > 1 {
		addr.City = strings.TrimSpace(match[1])
	} else {
		parts := strings.Split(remaining, ",")
		for _, p := range parts {
			cleanP := strings.TrimSpace(p)
			if cleanP == "" {
				continue
			}
			lowerP := strings.ToLower(cleanP)
			if strings.Contains(lowerP, "обл") || strings.Contains(lowerP, "мо") || strings.Contains(lowerP, "пгт") {
				continue
			}
			matched, _ := regexp.MatchString(`^[А-Яа-яЁё\s\-]+$`, cleanP)
			if matched {
				addr.City = cleanP
				break
			}
		}
	}

	addr.City = strings.TrimRight(addr.City, " ,.")
	addr.Street = strings.TrimRight(addr.Street, " ,.")
	addr.HouseNumber = strings.TrimRight(addr.HouseNumber, " ,.")

	return addr
}

func (r *geoRepo) parseGeocodeResponse(
	jsonData []byte,
) (*entities.GeoData, error) {

	var reponse dto.GeocodeResponse
	if err := json.Unmarshal(jsonData, &reponse); err != nil {
		return nil, errors.ErrDecodeResponse(err.Error())
	}

	if len(reponse.Results) == 0 {
		return nil, errors.ErrInvalidResponse("len(results) is zero")
	}

	item := reponse.Results[0]

	isCorrectType := item.ResultType == "street" || item.ResultType == "building"
	hasStreetConfidence := item.Rank.ConfidenceStreetLevel >= 0.7
	hasValidConfidence := item.Rank.Confidence >= 0.5

	if !(isCorrectType && hasStreetConfidence && hasValidConfidence) {
		return nil, errors.ErrAddressNotFound
	}

	return &entities.GeoData{
		Lat: item.Lat,
		Lon: item.Lon,
	}, nil
}

func (r *geoRepo) GetDistanceAndTravelTime(
	ctx context.Context,
	request *dto.GetDistanceAndTravelTimeRequest,
) (*dto.GetDistanceAndTravelTimeResponse, error) {

	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, r.baseURL+"/routing", nil)
	if err != nil {
		return nil, errors.ErrInvalidRequest
	}

	waypoints := fmt.Sprintf("%f,%f|%f,%f", request.CurrentLat, request.CurrentLon, request.TargetLat, request.TargetLon)

	params := url.Values{}
	params.Add("apiKey", r.apiKey)
	params.Add("waypoints", waypoints)
	params.Add("format", "json")
	params.Add("mode", "drive") //TODO: по транспорту

	httpRequest.URL.RawQuery = params.Encode()

	response, err := r.client.Do(httpRequest)
	if err != nil {
		return r.GetDistanceAndTravelTimeHaversine(ctx, request)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return r.GetDistanceAndTravelTimeHaversine(ctx, request)
	}

	body, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return nil, errors.ErrExternalService(err.Error())
	}

	result, err := r.parseRoutingResponse(body)
	if err != nil {
		return nil, err
	}

	return &dto.GetDistanceAndTravelTimeResponse{
		Distance: result.Distance,
		Time:     result.Time,
	}, nil
}

func (r *geoRepo) parseRoutingResponse(
	jsonData []byte,
) (*dto.RoutingData, error) {

	var reponse dto.RoutingResponse
	if err := json.Unmarshal(jsonData, &reponse); err != nil {
		return nil, errors.ErrDecodeResponse(err.Error())
	}

	if len(reponse.Results) == 0 {
		return nil, errors.ErrInvalidResponse("len(results) is zero")
	}

	item := reponse.Results[0]

	return &dto.RoutingData{
		Distance: math.Round(item.Distance / 1000),
		Time:     int(math.Round(item.Time / 60)),
	}, nil
}
