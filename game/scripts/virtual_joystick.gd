class_name IsolaJoystick
extends Control

signal movement_requested(value: Vector2)

@export var radius := 52.0
@export var knob_radius := 24.0

var input_vector := Vector2.ZERO
var _pointer_id := -1
var _dragging := false

func _ready() -> void:
	custom_minimum_size = Vector2(radius * 2.0, radius * 2.0)
	mouse_filter = Control.MOUSE_FILTER_STOP
	queue_redraw()

func _draw() -> void:
	var center := size * 0.5
	draw_circle(center, radius, Color(1, 0.97, 0.84, 0.66))
	draw_arc(center, radius - 2.0, 0, TAU, 40, Color("#493863"), 4.0, true)
	draw_circle(center + input_vector * (radius - knob_radius), knob_radius, Color("#ff5b9d"))
	draw_arc(center + input_vector * (radius - knob_radius), knob_radius - 1.0, 0, TAU, 28, Color.WHITE, 3.0, true)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and _pointer_id == -1:
			_pointer_id = event.index
			_dragging = true
			_update_vector(event.position)
		elif not event.pressed and event.index == _pointer_id:
			_release()
	elif event is InputEventScreenDrag and event.index == _pointer_id:
		_update_vector(event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
		if event.pressed:
			_update_vector(event.position)
		else:
			_release()
	elif event is InputEventMouseMotion and _dragging:
		_update_vector(event.position)

func _update_vector(local_position: Vector2) -> void:
	var center := size * 0.5
	input_vector = (local_position - center) / maxf(radius - knob_radius, 1.0)
	if input_vector.length() > 1.0:
		input_vector = input_vector.normalized()
	movement_requested.emit(input_vector)
	queue_redraw()

func _release() -> void:
	_pointer_id = -1
	_dragging = false
	input_vector = Vector2.ZERO
	movement_requested.emit(input_vector)
	queue_redraw()
