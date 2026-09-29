package entities

type GeoData struct {
	Lat float64 `json:"lat,required"`
	Lon float64 `json:"lon,required"`
}
