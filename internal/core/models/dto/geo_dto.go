package dto

import "github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"

type BatchGeoDataByAddressResponse map[string]entities.GeoData

type GeocodeResponse struct {
	Results []GeocodeResult `json:"results"`
}

type GeocodeResult struct {
	Lon        float64 `json:"lon"`
	Lat        float64 `json:"lat"`
	ResultType string  `json:"result_type"`
	Rank       Rank    `json:"rank"`
}

type Rank struct {
	Confidence              float64 `json:"confidence"`
	ConfidenceCityLevel     float64 `json:"confidence_city_level"`
	ConfidenceStreetLevel   float64 `json:"confidence_street_level"`
	ConfidenceBuildingLevel float64 `json:"confidence_building_level"`
	MatchType               string  `json:"match_type"`
}

type BatchGeocodeItem struct {
	Lat        float64 `json:"lat"`
	Lon        float64 `json:"lon"`
	ResultType string  `json:"result_type"`
	Rank       Rank    `json:"rank"`
}

type Address struct {
	City        string
	Street      string
	HouseNumber string
}

type GetDistanceAndTravelTimeRequest struct {
	CurrentLat float64 `json:"current_lat"`
	CurrentLon float64 `json:"current_lon"`
	TargetLat  float64 `json:"target_lat"`
	TargetLon  float64 `json:"target_lon"`
}

type GetDistanceAndTravelTimeResponse struct {
	Distance float64 `json:"distance"`
	Time     int     `json:"time"`
}

type RoutingResponse struct {
	Results []RoutingResult `json:"results"`
}

type RoutingResult struct {
	Distance float64 `json:"distance"`
	Time     float64 `json:"time"`
}

type RoutingData struct {
	Distance float64
	Time     int
}
