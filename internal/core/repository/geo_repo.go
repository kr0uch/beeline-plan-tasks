package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	geoapifyBaseURL = "https://api.geoapify.com/v1"
	routingMode     = "drive"

	earthRadiusKm    = 6371.0
	roadDetourFactor = 1.3
	defaultSpeedKmH  = 30.0

	batchPollInterval = 500 * time.Millisecond
	batchPollTimeout  = 60 * time.Second

	minConfidence            = 0.5
	minConfidenceStreetLevel = 0.7
)

var (
	addressMarkers = `ул|пр-кт|пер|б-р|проезд|пр-зд|ш|наб`

	reHouse        = regexp.MustCompile(`(?i)(?:^|\s|,)\s*(?:д\.|д\s)\s*(.*)$`)
	reKorpus       = regexp.MustCompile(`(?i)^([0-9А-Яа-яЁёA-Za-z\/\-]+?)\s*(?:,)?\s*(?:к|корп|корпус)\.?\s*(\d+)`)
	reStreet       = regexp.MustCompile(`(?i)((?:` + addressMarkers + `)\.?[ \t]*[А-Яа-яЁёA-Za-z0-9\-]+(?:[ \t]+[А-Яа-яЁёA-Za-z0-9\-]+)*|[А-Яа-яЁёA-Za-z0-9\-]+(?:[ \t]+[А-Яа-яЁёA-Za-z0-9\-]+)*[ \t]+(?:` + addressMarkers + `)\.?)`)
	reStreetPrefix = regexp.MustCompile(`(?i)^(` + addressMarkers + `)\.?\s*`)
	reStreetSuffix = regexp.MustCompile(`(?i)\s+(` + addressMarkers + `)\.?$`)
	reCityExplicit = regexp.MustCompile(`(?i)(?:г\.\s*город\s+|г\.\s*|город\s+|г\s+)([А-Яа-яЁё\-]+(?:\s+[А-Яа-яЁё\-]+)*)`)
	reCityName     = regexp.MustCompile(`^[А-Яа-яЁё\s\-]+$`)
)

type GeoRepo struct {
	client  *http.Client
	baseURL string
	apiKey  string
}

func NewGeoRepository(
	client *http.Client,
	apiKey string,
) *GeoRepo {
	return &GeoRepo{
		client:  client,
		baseURL: geoapifyBaseURL,
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

	roadDistance := earthRadiusKm * c * roadDetourFactor

	if speedKmH <= 0 {
		speedKmH = defaultSpeedKmH
	}

	travelTimeMin := roadDistance / speedKmH * 60.0

	return roundKm(roadDistance), int(math.Round(travelTimeMin))
}

func (r *GeoRepo) GetDistanceAndTravelTimeHaversine(
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

func (r *GeoRepo) GetDistanceAndTravelTime(
	ctx context.Context,
	request *dto.GetDistanceAndTravelTimeRequest,
) (*dto.GetDistanceAndTravelTimeResponse, error) {

	if request.CurrentLat == request.TargetLat && request.CurrentLon == request.TargetLon {
		return &dto.GetDistanceAndTravelTimeResponse{}, nil
	}

	result, err := r.fetchRoute(ctx, request)
	if err != nil {
		return r.GetDistanceAndTravelTimeHaversine(ctx, request)
	}

	return &dto.GetDistanceAndTravelTimeResponse{
		Distance: result.Distance,
		Time:     result.Time,
	}, nil
}

func (r *GeoRepo) fetchRoute(
	ctx context.Context,
	request *dto.GetDistanceAndTravelTimeRequest,
) (*dto.RoutingData, error) {

	params := url.Values{}
	params.Add("apiKey", r.apiKey)
	params.Add("waypoints", fmt.Sprintf(
		"%f,%f|%f,%f",
		request.CurrentLat, request.CurrentLon,
		request.TargetLat, request.TargetLon,
	))
	params.Add("format", "json")
	params.Add("mode", routingMode)

	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, r.baseURL+"/routing?"+params.Encode(), nil)
	if err != nil {
		return nil, errors.ErrCreateRequest(err.Error())
	}

	response, err := r.client.Do(httpRequest)
	if err != nil {
		return nil, geocoderError(err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, errors.ErrGeocoderService(response.Status)
	}

	var routing dto.RoutingResponse
	if err = json.NewDecoder(response.Body).Decode(&routing); err != nil {
		return nil, errors.ErrInvalidResponse(err.Error())
	}
	if len(routing.Results) == 0 {
		return nil, errors.ErrInvalidResponse("len(results) is zero")
	}

	item := routing.Results[0]

	return &dto.RoutingData{
		Distance: roundKm(item.Distance / 1000),
		Time:     int(math.Round(item.Time / 60)),
	}, nil
}

func (r *GeoRepo) BatchGetGeoDataByAddresses(
	ctx context.Context,
	addresses []string,
) (dto.BatchGeoDataByAddressResponse, error) {

	if len(addresses) == 0 {
		return make(dto.BatchGeoDataByAddressResponse), nil
	}

	formatted := make([]string, len(addresses))
	for i, rawAddr := range addresses {
		parsed := parseAddress(rawAddr)
		formatted[i] = fmt.Sprintf("%s, %s, %s", parsed.City, parsed.Street, parsed.HouseNumber)
	}

	bodyBytes, err := json.Marshal(formatted)
	if err != nil {
		return nil, errors.ErrMarshalPayload(err.Error())
	}

	URLPath := fmt.Sprintf("%s/batch/geocode/search?apiKey=%s", r.baseURL, r.apiKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, URLPath, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, errors.ErrCreateRequest(err.Error())
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.client.Do(req)
	if err != nil {
		return nil, geocoderError(err)
	}
	defer resp.Body.Close()

	var responseBody []byte
	switch resp.StatusCode {
	case http.StatusOK:
		responseBody, err = io.ReadAll(resp.Body)
		if err != nil {
			return nil, geocoderError(err)
		}
	case http.StatusAccepted:
		var job struct {
			ID string `json:"id"`
		}
		if err = json.NewDecoder(resp.Body).Decode(&job); err != nil {
			return nil, errors.ErrInvalidResponse(err.Error())
		}

		responseBody, err = r.pollBatchResult(ctx, job.ID)
		if err != nil {
			return nil, err
		}
	default:
		return nil, errors.ErrGeocoderService(resp.Status)
	}

	return parseBatchGeocodeResponse(responseBody, addresses)
}

func (r *GeoRepo) pollBatchResult(ctx context.Context, jobID string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, batchPollTimeout)
	defer cancel()

	pollURL := fmt.Sprintf("%s/batch/geocode/search?id=%s&apiKey=%s", r.baseURL, jobID, r.apiKey)

	ticker := time.NewTicker(batchPollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, errors.ErrGeocoderTimeout("batch geocoding: " + ctx.Err().Error())
		case <-ticker.C:
		}

		body, done, err := r.fetchBatchResult(ctx, pollURL)
		if err != nil {
			return nil, err
		}
		if done {
			return body, nil
		}
	}
}

func (r *GeoRepo) fetchBatchResult(ctx context.Context, pollURL string) ([]byte, bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pollURL, nil)
	if err != nil {
		return nil, false, errors.ErrCreateRequest(err.Error())
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return nil, false, geocoderError(err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, false, geocoderError(err)
		}
		return body, true, nil
	case http.StatusAccepted:
		return nil, false, nil
	default:
		return nil, false, errors.ErrGeocoderService(resp.Status)
	}
}

func parseBatchGeocodeResponse(
	jsonData []byte,
	addresses []string,
) (dto.BatchGeoDataByAddressResponse, error) {

	var items []dto.BatchGeocodeItem
	if err := json.Unmarshal(jsonData, &items); err != nil {
		return nil, errors.ErrInvalidResponse(err.Error())
	}

	result := make(dto.BatchGeoDataByAddressResponse, len(items))
	for i, item := range items {
		if i >= len(addresses) || addresses[i] == "" || !isConfidentMatch(item) {
			continue
		}
		result[addresses[i]] = entities.GeoData{Lat: item.Lat, Lon: item.Lon}
	}

	return result, nil
}

func isConfidentMatch(item dto.BatchGeocodeItem) bool {
	isPrecise := item.ResultType == "street" || item.ResultType == "building"
	return isPrecise &&
		item.Rank.ConfidenceStreetLevel >= minConfidenceStreetLevel &&
		item.Rank.Confidence >= minConfidence &&
		(item.Lat != 0 || item.Lon != 0)
}

func parseAddress(address string) *dto.Address {
	addr := &dto.Address{}
	remaining := address

	if match := reHouse.FindStringSubmatch(remaining); len(match) > 1 {
		house := strings.TrimSpace(match[1])
		addr.HouseNumber = reKorpus.ReplaceAllString(house, "$1 к$2")
		remaining = strings.Replace(remaining, match[0], "", 1)
	}

	if match := reStreet.FindStringSubmatch(remaining); len(match) > 1 {
		street := strings.TrimSpace(match[1])
		remaining = strings.Replace(remaining, match[0], "", 1)

		street = reStreetPrefix.ReplaceAllString(street, "")
		addr.Street = reStreetSuffix.ReplaceAllString(street, "")
	}

	if match := reCityExplicit.FindStringSubmatch(remaining); len(match) > 1 {
		addr.City = strings.TrimSpace(match[1])
	} else {
		addr.City = guessCity(remaining)
	}

	addr.City = strings.TrimRight(addr.City, " ,.")
	addr.Street = strings.TrimRight(addr.Street, " ,.")
	addr.HouseNumber = strings.TrimRight(addr.HouseNumber, " ,.")

	return addr
}

func guessCity(address string) string {
	for _, part := range strings.Split(address, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		if isRegionPart(part) {
			continue
		}

		if reCityName.MatchString(part) {
			return part
		}
	}
	return ""
}

func isRegionPart(part string) bool {
	for _, word := range strings.Fields(strings.ToLower(part)) {
		word = strings.TrimRight(word, ".")
		if word == "мо" || word == "пгт" || strings.HasPrefix(word, "обл") {
			return true
		}
	}
	return false
}

func roundKm(km float64) float64 {
	return math.Round(km*100) / 100
}

// geocoderError отбрасывает URL из ошибки клиента: в нём apiKey.
func geocoderError(err error) error {
	if urlErr, ok := err.(*url.Error); ok {
		err = urlErr.Err
	}
	if errors.IsTimeout(err) {
		return errors.ErrGeocoderTimeout(err.Error())
	}
	return errors.ErrGeocoderService(err.Error())
}
