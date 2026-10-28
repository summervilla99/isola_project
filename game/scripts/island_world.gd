class_name IslandWorld
extends Node3D

var avatar: AvatarDoll
var _camera: Camera3D
var _play_mode := false
var _camera_target := Vector3.ZERO

func _ready() -> void:
	_build_environment()
	_build_island()
	avatar = AvatarDoll.new()
	avatar.name = "PlayerAvatar"
	avatar.position = Vector3(0, 0.45, 0.6)
	avatar.rotation.y = -0.25
	add_child(avatar)

func set_play_mode(value: bool) -> void:
	_play_mode = value
	avatar.walking = false

func _process(delta: float) -> void:
	if not _play_mode:
		avatar.rotation.y = sin(Time.get_ticks_msec() * 0.00035) * 0.18
		return
	var input := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var direction := Vector3(input.x, 0, input.y)
	avatar.walking = direction.length() > 0.05
	if avatar.walking:
		avatar.position += direction.normalized() * delta * 2.0
		avatar.position.x = clampf(avatar.position.x, -4.2, 4.2)
		avatar.position.z = clampf(avatar.position.z, -3.2, 3.8)
		avatar.rotation.y = lerp_angle(avatar.rotation.y, atan2(direction.x, direction.z), delta * 9.0)
	_camera_target = avatar.position
	_camera.position = _camera.position.lerp(_camera_target + Vector3(5.8, 7.8, 8.8), delta * 2.6)
	_camera.look_at(_camera_target + Vector3(0, 1.0, 0))

func _build_environment() -> void:
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#62ced8")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#fff1d1")
	env.ambient_light_energy = 0.72
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.environment = env
	add_child(environment)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -35, 0)
	sun.light_color = Color("#ffe0a3")
	sun.light_energy = 1.4
	sun.shadow_enabled = true
	add_child(sun)

	_camera = Camera3D.new()
	_camera.position = Vector3(5.8, 7.8, 9.4)
	_camera.fov = 37.0
	_camera.current = true
	add_child(_camera)
	_camera.look_at(Vector3(0, 1.0, 0))

func _build_island() -> void:
	_add_mesh("Ocean", BoxMesh.new(), Vector3(0, -0.55, 0), Vector3(28, 0.7, 28), Color("#55ccd5"), 0.3)
	_add_mesh("Island", CylinderMesh.new(), Vector3(0, -0.14, 0), Vector3(1, 0.55, 1), Color("#9bd66f"), 0.9, {"top_radius": 5.3, "bottom_radius": 4.4, "height": 0.8})
	_add_mesh("Sand", CylinderMesh.new(), Vector3(0, 0.26, 0), Vector3(1, 0.2, 1), Color("#ffe4a3"), 0.86, {"top_radius": 4.65, "bottom_radius": 4.95, "height": 0.18})
	_add_mesh("Grass", CylinderMesh.new(), Vector3(-0.3, 0.42, -0.1), Vector3(1, 0.16, 1), Color("#9fe27a"), 0.92, {"top_radius": 3.95, "bottom_radius": 4.1, "height": 0.2})

	_build_house(Vector3(-2.5, 0.45, -1.1), Color("#ff77a8"), Color("#7a5cff"))
	_build_house(Vector3(2.8, 0.45, -1.25), Color("#ffbd59"), Color("#ef476f"))
	_build_tree(Vector3(-3.65, 0.48, 1.4), Color("#4ed1a1"))
	_build_tree(Vector3(3.6, 0.48, 1.65), Color("#77d96c"))
	_build_tree(Vector3(0.4, 0.48, -3.15), Color("#ff8ebd"))
	for pos in [Vector3(-1.4, 0.55, 2.55), Vector3(1.4, 0.55, 2.8), Vector3(-0.3, 0.55, -2.9)]:
		_build_flower(pos)

func _build_house(at: Vector3, wall: Color, roof: Color) -> void:
	_add_mesh("House", BoxMesh.new(), at + Vector3(0, 0.75, 0), Vector3(1.65, 1.5, 1.4), wall, 0.82)
	_add_mesh("Roof", PrismMesh.new(), at + Vector3(0, 1.72, 0), Vector3(2.0, 0.9, 1.8), roof, 0.62)
	_add_mesh("Door", BoxMesh.new(), at + Vector3(0, 0.55, 0.72), Vector3(0.48, 0.88, 0.08), Color("#563a64"), 0.7)

func _build_tree(at: Vector3, leaf_color: Color) -> void:
	_add_mesh("Trunk", CylinderMesh.new(), at + Vector3(0, 0.55, 0), Vector3(0.24, 1.1, 0.24), Color("#a56a4a"), 0.9, {"top_radius": 0.5, "bottom_radius": 0.65, "height": 1.0})
	_add_mesh("Canopy", SphereMesh.new(), at + Vector3(0, 1.55, 0), Vector3(1.05, 0.88, 1.05), leaf_color, 0.9)

func _build_flower(at: Vector3) -> void:
	_add_mesh("FlowerStem", CylinderMesh.new(), at + Vector3(0, 0.18, 0), Vector3(0.04, 0.35, 0.04), Color("#38a56f"), 0.9, {"top_radius": 0.5, "bottom_radius": 0.5, "height": 1.0})
	_add_mesh("Flower", SphereMesh.new(), at + Vector3(0, 0.42, 0), Vector3(0.18, 0.12, 0.18), Color("#ff4f9a"), 0.7)

func _add_mesh(label: String, mesh: PrimitiveMesh, at: Vector3, size: Vector3, color: Color, roughness: float, properties: Dictionary = {}) -> MeshInstance3D:
	for key in properties:
		mesh.set(key, properties[key])
	if mesh is SphereMesh:
		mesh.radial_segments = 16
		mesh.rings = 8
	elif mesh is CylinderMesh:
		mesh.radial_segments = 18
	var instance := MeshInstance3D.new()
	instance.name = label
	instance.mesh = mesh
	instance.position = at
	instance.scale = size
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	instance.material_override = material
	add_child(instance)
	return instance
