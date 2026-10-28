class_name RoomWorld
extends Node3D

const THEMES := {
	&"sunset": {
		"name": "노을 오두막",
		"floor": Color("#f2c58d"),
		"wall": Color("#ffd8c3"),
		"accent": Color("#ff6d96")
	},
	&"toy": {
		"name": "장난감 방",
		"floor": Color("#ffd65c"),
		"wall": Color("#c8b8ff"),
		"accent": Color("#5667ff")
	},
	&"greenhouse": {
		"name": "초록 온실",
		"floor": Color("#b9d790"),
		"wall": Color("#d9f5dc"),
		"accent": Color("#25a884")
	}
}

var avatar: AvatarDoll
var current_theme: StringName = &"sunset"
var furniture: Array[Dictionary] = []
var selected_index := -1
var _camera: Camera3D
var _floor_material: StandardMaterial3D
var _wall_materials: Array[StandardMaterial3D] = []
var _furniture_root: Node3D

func _ready() -> void:
	_build_room()
	avatar = AvatarDoll.new()
	avatar.name = "RoomAvatar"
	avatar.scale = Vector3.ONE * 0.82
	avatar.position = Vector3(1.8, 0.02, 0.0)
	avatar.rotation.y = -0.55
	add_child(avatar)
	set_active(false)

func set_active(value: bool) -> void:
	visible = value
	process_mode = Node.PROCESS_MODE_INHERIT if value else Node.PROCESS_MODE_DISABLED
	if is_instance_valid(_camera):
		_camera.current = value

func apply_avatar_config(config: AvatarConfig) -> void:
	avatar.apply_config(config)

func apply_theme(theme_id: StringName) -> void:
	if not THEMES.has(theme_id):
		return
	current_theme = theme_id
	var theme: Dictionary = THEMES[theme_id]
	_floor_material.albedo_color = theme.floor
	for material in _wall_materials:
		material.albedo_color = theme.wall

func add_furniture(kind: StringName) -> void:
	if furniture.size() >= 12:
		return
	var slots := [
		Vector3(-1.3, 0.17, -1.0), Vector3(0.2, 0.17, -1.25), Vector3(1.65, 0.17, -0.9),
		Vector3(-1.55, 0.17, 0.3), Vector3(0.15, 0.17, 0.25), Vector3(1.7, 0.17, 0.45),
		Vector3(-0.9, 0.17, 1.45), Vector3(0.75, 0.17, 1.45)
	]
	var index := furniture.size()
	var node := _make_furniture(kind)
	node.position = slots[index % slots.size()] + Vector3(0, 0, floori(index / slots.size()) * -0.35)
	_furniture_root.add_child(node)
	furniture.append({"kind": String(kind), "position": node.position, "rotation": 0.0, "node": node})
	selected_index = furniture.size() - 1

func rotate_selected() -> void:
	if selected_index < 0 or selected_index >= furniture.size():
		return
	var item: Dictionary = furniture[selected_index]
	item.rotation = fmod(float(item.rotation) + PI * 0.5, TAU)
	(item.node as Node3D).rotation.y = item.rotation
	furniture[selected_index] = item

func remove_selected() -> void:
	if selected_index < 0 or selected_index >= furniture.size():
		return
	var item: Dictionary = furniture[selected_index]
	(item.node as Node).queue_free()
	furniture.remove_at(selected_index)
	selected_index = furniture.size() - 1

func save_draft() -> bool:
	var items: Array[Dictionary] = []
	for item in furniture:
		var position: Vector3 = item.position
		items.append({
			"kind": item.kind,
			"x": position.x,
			"z": position.z,
			"rotation": item.rotation
		})
	var payload := {"version": 1, "theme": String(current_theme), "furniture": items}
	var file := FileAccess.open("user://room_draft.json", FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(payload, "\t"))
	return true

func _build_room() -> void:
	var env_node := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#79d3dc")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#fff2d7")
	env.ambient_light_energy = 0.9
	env_node.environment = env
	add_child(env_node)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -24, 0)
	sun.light_color = Color("#ffe8bc")
	sun.light_energy = 1.35
	sun.shadow_enabled = true
	add_child(sun)

	_camera = Camera3D.new()
	_camera.position = Vector3(5.5, 6.5, 7.2)
	_camera.fov = 36.0
	add_child(_camera)
	_camera.look_at(Vector3(0, 0.9, 0))

	_floor_material = _material(Color("#f2c58d"), 0.92)
	_add_box("Floor", Vector3(0, -0.12, 0), Vector3(6.4, 0.24, 5.4), _floor_material)
	for wall_data in [
		["BackWall", Vector3(0, 1.5, -2.7), Vector3(6.4, 3.2, 0.2)],
		["LeftWall", Vector3(-3.2, 1.5, 0), Vector3(0.2, 3.2, 5.4)]
	]:
		var material := _material(Color("#ffd8c3"), 0.95)
		_wall_materials.append(material)
		_add_box(wall_data[0], wall_data[1], wall_data[2], material)

	# Window, rug and ceiling stickers keep an empty room expressive before furniture.
	_add_box("Window", Vector3(1.65, 1.65, -2.56), Vector3(1.65, 1.2, 0.08), _material(Color("#77d8e0"), 0.3))
	_add_box("Rug", Vector3(0.15, 0.03, 0.35), Vector3(2.4, 0.05, 1.75), _material(Color("#fff0aa"), 0.8))
	_furniture_root = Node3D.new()
	_furniture_root.name = "Furniture"
	add_child(_furniture_root)

func _make_furniture(kind: StringName) -> Node3D:
	var root := Node3D.new()
	root.name = String(kind).capitalize()
	var accent: Color = THEMES[current_theme].accent
	match kind:
		&"sofa":
			_add_box_to(root, "Seat", Vector3(0, 0.35, 0), Vector3(1.35, 0.38, 0.62), _material(accent, 0.82))
			_add_box_to(root, "Back", Vector3(0, 0.72, -0.24), Vector3(1.35, 0.62, 0.2), _material(accent.lightened(0.1), 0.82))
			_add_box_to(root, "ArmL", Vector3(-0.72, 0.48, 0), Vector3(0.18, 0.55, 0.68), _material(accent.darkened(0.08), 0.82))
			_add_box_to(root, "ArmR", Vector3(0.72, 0.48, 0), Vector3(0.18, 0.55, 0.68), _material(accent.darkened(0.08), 0.82))
		&"shelf":
			_add_box_to(root, "Frame", Vector3(0, 0.75, 0), Vector3(1.1, 1.5, 0.34), _material(Color("#8f5d52"), 0.9))
			for y in [0.35, 0.75, 1.15]:
				_add_box_to(root, "Books", Vector3(0, y, 0.2), Vector3(0.82, 0.18, 0.12), _material(accent.lightened(y * 0.1), 0.78))
		_:
			_add_box_to(root, "Pot", Vector3(0, 0.25, 0), Vector3(0.48, 0.5, 0.48), _material(Color("#ff9a68"), 0.88))
			for offset in [-0.18, 0.0, 0.18]:
				_add_sphere_to(root, "Leaf", Vector3(offset, 0.75 + absf(offset), 0), Vector3(0.3, 0.5, 0.22), _material(Color("#43bd82"), 0.9))
	return root

func _add_box(label: String, at: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	return _add_box_to(self, label, at, size, material)

func _add_box_to(parent: Node, label: String, at: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = label
	instance.mesh = BoxMesh.new()
	instance.position = at
	instance.scale = size
	instance.material_override = material
	parent.add_child(instance)
	return instance

func _add_sphere_to(parent: Node, label: String, at: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	var sphere := SphereMesh.new()
	sphere.radial_segments = 12
	sphere.rings = 6
	var instance := MeshInstance3D.new()
	instance.name = label
	instance.mesh = sphere
	instance.position = at
	instance.scale = size
	instance.material_override = material
	parent.add_child(instance)
	return instance

func _material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	return material
