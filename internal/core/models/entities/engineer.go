package entities

type Engineer struct {
	ID           string      `json:"id,required"`
	Name         string      `json:"name,required"`
	Skills       []Skill     `json:"skills,required"`
	Equipment    []Equipment `json:"equipment,required"`
	Transport    string      `json:"transport,required"`
	ShiftStart   int         `json:"shift_start,required"`
	ShiftEnd     int         `json:"shift_end,required"`
	DepotAddress string      `json:"depot_address,required"`
	DepotLat     float64     `json:"depot_lat,omitempty"`
	DepotLon     float64     `json:"depot_lon,omitempty"`
}
