extends SceneTree

func _init() -> void:
	call_deferred("run")

func run() -> void:
	var room := RoomWorld.new()
	root.add_child(room)
	await process_frame
	room.set_active(true)
	room.apply_theme(&"toy")
	assert(room.current_theme == &"toy")
	room.add_furniture(&"sofa")
	room.add_furniture(&"plant")
	assert(room.furniture.size() == 2)
	var original_rotation: float = room.furniture[-1].rotation
	room.rotate_selected()
	assert(room.furniture[-1].rotation != original_rotation)
	room.remove_selected()
	assert(room.furniture.size() == 1)
	assert(room.save_draft())
	var save_path := ProjectSettings.globalize_path("user://room_draft.json")
	assert(FileAccess.file_exists(save_path))
	DirAccess.remove_absolute(save_path)
	print("Room decoration tests passed")
	quit(0)
