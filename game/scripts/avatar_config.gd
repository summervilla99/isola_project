class_name AvatarConfig
extends RefCounted

const SPECIES := [&"human", &"capybara", &"spirit"]
const PALETTES := [
	Color("#f7b6cf"),
	Color("#bc7a52"),
	Color("#73d8c1"),
	Color("#a991e8"),
	Color("#ffd45c")
]

var species: StringName = &"capybara"
var body_color: Color = PALETTES[1]
var accent_color: Color = Color("#ff5b9d")
var accessory: StringName = &"flower"

func set_species(value: StringName) -> void:
	if value in SPECIES:
		species = value

func set_palette(index: int) -> void:
	body_color = PALETTES[clampi(index, 0, PALETTES.size() - 1)]

func randomize() -> void:
	species = SPECIES.pick_random()
	body_color = PALETTES.pick_random()
	accent_color = [Color("#ff5b9d"), Color("#ff8c42"), Color("#6558ff"), Color("#13b8a6")].pick_random()
	accessory = [&"flower", &"sprout", &"star"].pick_random()

func to_dictionary() -> Dictionary:
	return {
		"species": String(species),
		"body_color": body_color.to_html(false),
		"accent_color": accent_color.to_html(false),
		"accessory": String(accessory)
	}
