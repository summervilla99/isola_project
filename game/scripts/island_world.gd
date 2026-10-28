class_name IslandWorld
extends Node3D

var avatar: AvatarDoll
var residents: Array[AvatarDoll] = []
var _camera: Camera3D
var _play_mode := false
var _camera_target := Vector3.ZERO
var _mobile_input := Vector2.ZERO
var _floating_details: Array[Node3D] = []
var _time := 0.0

func _ready() -> void:
	_build_environment()
	_build_island()
	_build_player()
	_build_residents()

func set_play_mode(value: bool) -> void:
	_play_mode = value
	avatar.walking = false

func set_active(value: bool) -> void:
	visible = value
	process_mode = Node.PROCESS_MODE_INHERIT if value else Node.PROCESS_MODE_DISABLED
	if is_instance_valid(_camera):
		_camera.current = value

func set_mobile_input(value: Vector2) -> void:
	_mobile_input = value

func _process(delta: float) -> void:
	_time += delta
	for index in _floating_details.size():
		var detail := _floating_details[index]
		var base_y: float = detail.get_meta("base_y", detail.position.y)
		detail.position.y = base_y + sin(_time * 1.7 + index * 1.4) * 0.06
		detail.rotation.y += delta * (0.22 + index * 0.02)

	if not _play_mode:
		avatar.rotation.y = sin(Time.get_ticks_msec() * 0.00035) * 0.18
		return
	var input := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if _mobile_input.length() > input.length():
		input = _mobile_input
	var direction := Vector3(input.x, 0, input.y)
	avatar.walking = direction.length() > 0.05
	if avatar.walking:
		var next_position := avatar.position + direction.normalized() * delta * 2.0
		if Vector2(next_position.x, next_position.z).length() <= 5.25:
			next_position.y = lerpf(avatar.position.y, _terrain_root_height(next_position), delta * 7.0)
			avatar.position = next_position
		avatar.rotation.y = lerp_angle(avatar.rotation.y, atan2(direction.x, direction.z), delta * 9.0)
	_camera_target = avatar.position
	_camera.position = _camera.position.lerp(_camera_target + Vector3(6.0, 7.2, 9.4), delta * 2.6)
	_camera.look_at(_camera_target + Vector3(0, 1.0, 0))

func _terrain_root_height(position: Vector3) -> float:
	if Vector2(position.x + 1.4, position.z + 1.5).length() < 2.15:
		return 0.92
	if Vector2(position.x, position.z).length() < 4.65:
		return 0.62
	return 0.42

func _build_player() -> void:
	avatar = AvatarDoll.new()
	avatar.name = "PlayerAvatar"
	avatar.position = Vector3(0.25, 0.62, 1.65)
	avatar.rotation.y = -0.25
	add_child(avatar)

func _build_residents() -> void:
	var resident_specs := [
		["Mora", Vector3(-0.9, 0.62, 0.7), Color("#a96f4f"), Color("#4e63f5"), &"sprout"],
		["Podo", Vector3(1.65, 0.62, -0.15), Color("#e4ad78"), Color("#ff6b8f"), &"flower"]
	]
	for spec in resident_specs:
		var config := AvatarConfig.new()
		config.species = &"capybara"
		config.body_color = spec[2]
		config.accent_color = spec[3]
		config.accessory = spec[4]
		var resident := AvatarDoll.new()
		resident.name = spec[0]
		resident.config = config
		resident.position = spec[1]
		resident.scale = Vector3.ONE * 0.82
		resident.rotation.y = 0.3 if residents.is_empty() else -0.7
		add_child(resident)
		residents.append(resident)

func _build_environment() -> void:
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#65cdd7")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#fff1d1")
	env.ambient_light_energy = 0.72
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.environment = env
	add_child(environment)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -35, 0)
	sun.light_color = Color("#ffd99d")
	sun.light_energy = 1.45
	sun.shadow_enabled = true
	add_child(sun)

	_camera = Camera3D.new()
	_camera.position = Vector3(5.0, 7.4, 9.6)
	_camera.fov = 36.0
	_camera.current = true
	add_child(_camera)
	_camera.look_at(Vector3(-1.6, 0.9, 0))

func _build_island() -> void:
	_mesh(self, "Ocean", BoxMesh.new(), Vector3(0, -0.82, 0), Vector3(34, 0.72, 34), Color("#45c9d3"), 0.28)
	_mesh(self, "IslandRock", CylinderMesh.new(), Vector3(0, -0.18, 0), Vector3.ONE, Color("#d99a74"), 0.94, {"top_radius": 6.35, "bottom_radius": 5.4, "height": 1.15})
	_mesh(self, "BeachTier", CylinderMesh.new(), Vector3(0, 0.33, 0), Vector3.ONE, Color("#ffe5ad"), 0.88, {"top_radius": 5.75, "bottom_radius": 6.05, "height": 0.2})
	_mesh(self, "LifeTier", CylinderMesh.new(), Vector3(0, 0.53, -0.05), Vector3.ONE, Color("#9edb72"), 0.94, {"top_radius": 4.75, "bottom_radius": 5.0, "height": 0.42})
	_mesh(self, "WindTier", CylinderMesh.new(), Vector3(-1.4, 0.83, -1.5), Vector3.ONE, Color("#b6e887"), 0.94, {"top_radius": 2.25, "bottom_radius": 2.45, "height": 0.42})

	_build_paths()
	_build_shell_fountain(Vector3(0, 0.76, 0.25))
	_build_ferry_dock(Vector3(4.75, 0.42, 1.35))
	_build_spirit_tree(Vector3(-1.45, 1.08, -1.55))
	_build_memory_theater(Vector3(2.8, 0.76, -1.75))
	_build_wind_garden(Vector3(-3.0, 0.75, -0.4))

	_build_house(Vector3(-3.25, 0.73, 1.05), Color("#ff91ad"), Color("#755cff"))
	_build_house(Vector3(2.75, 0.73, 1.1), Color("#ffbd65"), Color("#ef5f82"))
	_build_house(Vector3(0.65, 1.04, -2.55), Color("#c7b5ff"), Color("#4e63f5"))

	for tree_spec in [
		[Vector3(-4.45, 0.5, 2.25), Color("#49c99a")],
		[Vector3(4.25, 0.5, -0.4), Color("#73d96b")],
		[Vector3(-4.2, 0.5, -2.2), Color("#ff8ebd")],
		[Vector3(3.7, 0.5, 2.65), Color("#67d6b0")]
	]:
		_build_tree(tree_spec[0], tree_spec[1])

	for flower_position in [
		Vector3(-2.1, 0.77, 2.1), Vector3(1.3, 0.77, 2.55), Vector3(-3.6, 0.52, 3.2),
		Vector3(3.7, 0.52, -2.7), Vector3(-2.4, 1.08, -2.5), Vector3(-0.2, 1.08, -2.9)
	]:
		_build_flower(flower_position)

func _build_paths() -> void:
	var path_material := _material(Color("#ffe7bd"), 0.9)
	for path_data in [
		[Vector3(0, 0.77, 1.5), Vector3(1.25, 0.07, 2.2), 0.0],
		[Vector3(-1.65, 0.77, 0.3), Vector3(2.15, 0.07, 0.85), -0.3],
		[Vector3(1.75, 0.77, 0.15), Vector3(2.05, 0.07, 0.82), 0.28]
	]:
		var path := _mesh_with_material(self, "GardenPath", BoxMesh.new(), path_data[0], path_data[1], path_material)
		path.rotation.y = path_data[2]
	for index in 4:
		_mesh(self, "WindStep", BoxMesh.new(), Vector3(-0.25 - index * 0.34, 0.78 + index * 0.09, -1.05 - index * 0.18), Vector3(0.9, 0.12, 0.36), Color("#f6cf9c"), 0.92)

func _build_shell_fountain(at: Vector3) -> void:
	var root := _landmark("ShellFountain", at)
	_mesh(root, "Basin", CylinderMesh.new(), Vector3(0, 0.12, 0), Vector3.ONE, Color("#f9ddc8"), 0.72, {"top_radius": 1.05, "bottom_radius": 1.12, "height": 0.24})
	_mesh(root, "Water", CylinderMesh.new(), Vector3(0, 0.26, 0), Vector3.ONE, Color("#78e3e0"), 0.25, {"top_radius": 0.86, "bottom_radius": 0.86, "height": 0.08})
	var pearl := _mesh(root, "Pearl", SphereMesh.new(), Vector3(0, 0.78, 0), Vector3(0.36, 0.36, 0.36), Color("#fff6e8"), 0.18)
	for angle in [0.0, TAU / 5.0, TAU * 2.0 / 5.0, TAU * 3.0 / 5.0, TAU * 4.0 / 5.0]:
		var shell := _mesh(root, "ShellPetal", SphereMesh.new(), Vector3(cos(angle) * 0.48, 0.55, sin(angle) * 0.48), Vector3(0.45, 0.16, 0.28), Color("#ffb9c9"), 0.58)
		shell.rotation.y = -angle
	pearl.set_meta("base_y", pearl.position.y)
	_floating_details.append(pearl)

func _build_ferry_dock(at: Vector3) -> void:
	var root := _landmark("FerryDock", at)
	for index in 7:
		_mesh(root, "DockPlank", BoxMesh.new(), Vector3(index * 0.48, 0, 0), Vector3(0.46, 0.12, 1.05), Color("#a56d53" if index % 2 == 0 else "#bc8060"), 0.9)
		if index % 2 == 0:
			_mesh(root, "Post", CylinderMesh.new(), Vector3(index * 0.48, -0.25, -0.62), Vector3(0.09, 0.75, 0.09), Color("#714c43"), 0.9, {"top_radius": 0.5, "bottom_radius": 0.62, "height": 1.0})
	var ferry := Node3D.new()
	ferry.name = "GlowFerry"
	ferry.position = Vector3(3.7, -0.1, 0.2)
	root.add_child(ferry)
	_mesh(ferry, "Hull", PrismMesh.new(), Vector3.ZERO, Vector3(1.65, 0.5, 0.9), Color("#ff946c"), 0.78)
	_mesh(ferry, "Canopy", PrismMesh.new(), Vector3(0, 0.82, 0), Vector3(1.45, 0.55, 1.0), Color("#fff1c7"), 0.8)
	_mesh(ferry, "Lantern", SphereMesh.new(), Vector3(0.65, 0.65, 0.4), Vector3(0.14, 0.14, 0.14), Color("#ffd65c"), 0.2)

func _build_spirit_tree(at: Vector3) -> void:
	var root := _landmark("HeartgrainTree", at)
	_mesh(root, "Trunk", CylinderMesh.new(), Vector3(0, 0.85, 0), Vector3(0.42, 1.7, 0.42), Color("#9b6854"), 0.92, {"top_radius": 0.7, "bottom_radius": 1.0, "height": 1.0})
	for canopy_data in [
		[Vector3(0, 2.0, 0), Vector3(1.4, 1.1, 1.3), Color("#55d0a0")],
		[Vector3(-0.85, 1.75, 0.1), Vector3(0.9, 0.8, 0.9), Color("#86df7b")],
		[Vector3(0.85, 1.72, -0.1), Vector3(0.9, 0.82, 0.9), Color("#ff90bd")]
	]:
		_mesh(root, "Canopy", SphereMesh.new(), canopy_data[0], canopy_data[1], canopy_data[2], 0.88)
	for index in 3:
		var orb := _mesh(root, "MemoryLight%d" % index, SphereMesh.new(), Vector3(-0.7 + index * 0.7, 2.35 + index * 0.12, 0.45), Vector3(0.16, 0.22, 0.16), Color("#d8c8ff" if index != 1 else "#fff1a8"), 0.16)
		orb.set_meta("base_y", orb.position.y)
		_floating_details.append(orb)

func _build_memory_theater(at: Vector3) -> void:
	var root := _landmark("MemoryTheater", at)
	_mesh(root, "Screen", BoxMesh.new(), Vector3(0, 0.92, -0.15), Vector3(1.8, 1.18, 0.12), Color("#fff4df"), 0.82)
	_mesh(root, "ScreenGlow", BoxMesh.new(), Vector3(0, 0.95, -0.07), Vector3(1.5, 0.9, 0.04), Color("#b8e7e1"), 0.25)
	for index in 3:
		_mesh(root, "Cushion", SphereMesh.new(), Vector3(-0.65 + index * 0.65, 0.12, 1.0 + abs(index - 1) * 0.18), Vector3(0.42, 0.16, 0.35), [Color("#ff91ad"), Color("#ffd65c"), Color("#bda6ff")][index], 0.82)

func _build_wind_garden(at: Vector3) -> void:
	var root := _landmark("WindGarden", at)
	_mesh(root, "LookoutDeck", CylinderMesh.new(), Vector3.ZERO, Vector3.ONE, Color("#f4cf9b"), 0.9, {"top_radius": 1.0, "bottom_radius": 1.08, "height": 0.14})
	_mesh(root, "Bench", BoxMesh.new(), Vector3(0, 0.28, 0), Vector3(1.25, 0.22, 0.38), Color("#8e5f53"), 0.9)
	for offset in [-0.72, 0.72]:
		_mesh(root, "Lantern", SphereMesh.new(), Vector3(offset, 0.72, -0.15), Vector3(0.16, 0.2, 0.16), Color("#ffd65c"), 0.22)

func _build_house(at: Vector3, wall: Color, roof: Color) -> void:
	var root := Node3D.new()
	root.name = "CapybaraHome"
	root.position = at
	add_child(root)
	_mesh(root, "House", BoxMesh.new(), Vector3(0, 0.7, 0), Vector3(1.8, 1.4, 1.45), wall, 0.84)
	_mesh(root, "Roof", PrismMesh.new(), Vector3(0, 1.62, 0), Vector3(2.15, 0.88, 1.85), roof, 0.64)
	_mesh(root, "WideLowDoor", BoxMesh.new(), Vector3(0, 0.48, 0.76), Vector3(0.66, 0.8, 0.08), Color("#563a64"), 0.72)
	for x in [-0.56, 0.56]:
		_mesh(root, "Window", SphereMesh.new(), Vector3(x, 0.88, 0.76), Vector3(0.2, 0.24, 0.06), Color("#fff3a8"), 0.25)

func _build_tree(at: Vector3, leaf_color: Color) -> void:
	var root := Node3D.new()
	root.name = "FruitTree"
	root.position = at
	add_child(root)
	_mesh(root, "Trunk", CylinderMesh.new(), Vector3(0, 0.55, 0), Vector3(0.24, 1.1, 0.24), Color("#a56a4a"), 0.9, {"top_radius": 0.5, "bottom_radius": 0.65, "height": 1.0})
	_mesh(root, "Canopy", SphereMesh.new(), Vector3(0, 1.55, 0), Vector3(1.05, 0.88, 1.05), leaf_color, 0.9)
	for fruit_position in [Vector3(-0.35, 1.55, 0.82), Vector3(0.42, 1.72, 0.7)]:
		_mesh(root, "Citrus", SphereMesh.new(), fruit_position, Vector3(0.13, 0.13, 0.13), Color("#ffb347"), 0.66)

func _build_flower(at: Vector3) -> void:
	_mesh(self, "FlowerStem", CylinderMesh.new(), at + Vector3(0, 0.18, 0), Vector3(0.04, 0.35, 0.04), Color("#38a56f"), 0.9, {"top_radius": 0.5, "bottom_radius": 0.5, "height": 1.0})
	_mesh(self, "Flower", SphereMesh.new(), at + Vector3(0, 0.42, 0), Vector3(0.18, 0.12, 0.18), Color("#ff4f9a"), 0.7)

func _landmark(label: String, at: Vector3) -> Node3D:
	var root := Node3D.new()
	root.name = label
	root.position = at
	add_child(root)
	return root

func _mesh(parent: Node, label: String, mesh: PrimitiveMesh, at: Vector3, size: Vector3, color: Color, roughness: float, properties: Dictionary = {}) -> MeshInstance3D:
	return _mesh_with_material(parent, label, mesh, at, size, _material(color, roughness), properties)

func _mesh_with_material(parent: Node, label: String, mesh: PrimitiveMesh, at: Vector3, size: Vector3, material: Material, properties: Dictionary = {}) -> MeshInstance3D:
	for key in properties:
		mesh.set(key, properties[key])
	if mesh is SphereMesh:
		mesh.radial_segments = 16
		mesh.rings = 8
	elif mesh is CylinderMesh:
		mesh.radial_segments = 20
	var instance := MeshInstance3D.new()
	instance.name = label
	instance.mesh = mesh
	instance.position = at
	instance.scale = size
	instance.material_override = material
	parent.add_child(instance)
	return instance

func _material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.metallic = 0.04
	return material
