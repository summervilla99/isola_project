extends SceneTree

func _init() -> void:
	var config := AvatarConfig.new()
	assert(config.species == &"capybara")
	config.set_species(&"human")
	assert(config.species == &"human")
	config.set_species(&"invalid")
	assert(config.species == &"human")
	config.set_palette(999)
	assert(config.body_color == AvatarConfig.PALETTES[-1])
	var serialized := config.to_dictionary()
	assert(serialized.species == "human")
	assert(serialized.has("accessory"))
	print("AvatarConfig tests passed")
	quit(0)
