extends SceneTree

func _init() -> void:
	call_deferred("run")

func run() -> void:
	var joystick := IsolaJoystick.new()
	joystick.size = Vector2(112, 112)
	root.add_child(joystick)
	await process_frame
	joystick._update_vector(Vector2(112, 56))
	assert(joystick.input_vector.x > 0.99)
	assert(absf(joystick.input_vector.y) < 0.01)
	joystick._release()
	assert(joystick.input_vector == Vector2.ZERO)
	print("Virtual joystick tests passed")
	quit(0)
