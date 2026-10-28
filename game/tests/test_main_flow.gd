extends SceneTree

func _init() -> void:
	call_deferred("run")

func run() -> void:
	var scene := load("res://scenes/main.tscn") as PackedScene
	var main := scene.instantiate()
	root.add_child(main)
	await process_frame
	assert(main.current_screen == main.Screen.WELCOME)
	main._show_creator()
	await process_frame
	assert(main.current_screen == main.Screen.CREATOR)
	main._select_species(&"spirit")
	await process_frame
	assert(main.config.species == &"spirit")
	main._enter_island()
	await process_frame
	assert(main.current_screen == main.Screen.ISLAND)
	assert(main.world._play_mode)
	print("Main onboarding flow tests passed")
	quit(0)
