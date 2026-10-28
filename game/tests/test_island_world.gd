extends SceneTree

func _init() -> void:
	call_deferred("run")

func run() -> void:
	var island := IslandWorld.new()
	root.add_child(island)
	await process_frame
	assert(island.residents.size() == 2)
	assert(island.residents.all(func(resident: AvatarDoll) -> bool: return resident.config.species == &"capybara"))
	for landmark in ["ShellFountain", "FerryDock", "HeartgrainTree", "MemoryTheater", "WindGarden"]:
		assert(island.has_node(landmark), "Missing landmark: %s" % landmark)
	assert(island._terrain_root_height(Vector3(-1.4, 0, -1.5)) > island._terrain_root_height(Vector3(5.0, 0, 0)))
	print("Capybara island world tests passed")
	quit(0)
