package entities

type Task struct {
	ID                int         `json:"id,required"`
	TypeBK            string      `json:"type_bk,required"`
	TypeHD            string      `json:"type_hd,required"`
	District          string      `json:"district,required"`
	Address           string      `json:"address,required"`
	Lat               float64     `json:"lat,omitempty"`
	Lon               float64     `json:"lon,omitempty"`
	TWStart           int         `json:"tw_start,required"`
	TWEnd             int         `json:"tw_end,required"`
	ServiceTime       int         `json:"service_time,omitempty"`
	Priority          string      `json:"priority,omitempty"`
	RequiredSkills    []Skill     `json:"required_skills,omitempty"`
	RequiredEquipment []Equipment `json:"required_equipment,omitempty"`
}
