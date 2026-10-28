class_name AvatarDoll
extends Node3D

var config := AvatarConfig.new()
var walking := false
var _time := 0.0
var _left_arm: MeshInstance3D
var _right_arm: MeshInstance3D
var _left_leg: MeshInstance3D
var _right_leg: MeshInstance3D
var _body_root: Node3D
var _hero_sprite: Sprite3D

func _ready() -> void:
	rebuild()

func apply_config(value: AvatarConfig) -> void:
	config = value
	rebuild()

func rebuild() -> void:
	for child in get_children():
		child.free()

	_body_root = Node3D.new()
	_body_root.name = "DollBody"
	add_child(_body_root)
	_hero_sprite = null
	if config.species == &"capybara":
		var hero_texture := load("res://assets/capybara_hero.png") as Texture2D
		if hero_texture:
			_hero_sprite = Sprite3D.new()
			_hero_sprite.name = "HeroSprite"
			_hero_sprite.texture = hero_texture
			_hero_sprite.pixel_size = 0.00205
			_hero_sprite.position = Vector3(0, 1.38, 0)
			_hero_sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			_hero_sprite.shaded = false
			_hero_sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
			_hero_sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
			_body_root.add_child(_hero_sprite)
			return

	var body_material := _material(config.body_color, 0.72)
	var accent_material := _material(config.accent_color, 0.66)
	var cream_material := _material(Color("#fff6db"), 0.78)
	var dark_material := _material(Color("#33284d"), 0.6)

	_part("Torso", Vector3(0.72, 0.82, 0.48), Vector3(0, 1.12, 0), body_material, "capsule")
	_part("Belly", Vector3(0.5, 0.42, 0.5), Vector3(0, 1.03, 0.24), cream_material, "sphere")
	_left_arm = _part("LeftArm", Vector3(0.22, 0.62, 0.22), Vector3(-0.48, 1.12, 0), body_material, "capsule")
	_right_arm = _part("RightArm", Vector3(0.22, 0.62, 0.22), Vector3(0.48, 1.12, 0), body_material, "capsule")
	_left_leg = _part("LeftLeg", Vector3(0.28, 0.56, 0.3), Vector3(-0.22, 0.48, 0), dark_material, "capsule")
	_right_leg = _part("RightLeg", Vector3(0.28, 0.56, 0.3), Vector3(0.22, 0.48, 0), dark_material, "capsule")

	var head_scale := Vector3(1.05, 0.9, 0.92)
	if config.species == &"human":
		head_scale = Vector3(0.9, 0.94, 0.84)
	elif config.species == &"spirit":
		head_scale = Vector3(0.94, 1.02, 0.86)
	_part("Head", head_scale, Vector3(0, 1.93, 0), body_material, "sphere")

	if config.species == &"capybara":
		_part("Snout", Vector3(0.7, 0.36, 0.38), Vector3(0, 1.78, 0.43), body_material, "sphere")
		_part("EarL", Vector3(0.25, 0.28, 0.18), Vector3(-0.39, 2.3, 0), accent_material, "sphere")
		_part("EarR", Vector3(0.25, 0.28, 0.18), Vector3(0.39, 2.3, 0), accent_material, "sphere")
	elif config.species == &"human":
		_part("Hair", Vector3(0.94, 0.45, 0.9), Vector3(0, 2.2, -0.03), accent_material, "sphere")
	else:
		_part("SpiritTip", Vector3(0.28, 0.52, 0.28), Vector3(0, 2.48, 0), accent_material, "capsule")

	_part("EyeL", Vector3(0.115, 0.14, 0.08), Vector3(-0.24, 2.0, 0.43), dark_material, "sphere")
	_part("EyeR", Vector3(0.115, 0.14, 0.08), Vector3(0.24, 2.0, 0.43), dark_material, "sphere")
	_part("BlushL", Vector3(0.18, 0.08, 0.04), Vector3(-0.39, 1.85, 0.45), accent_material, "sphere")
	_part("BlushR", Vector3(0.18, 0.08, 0.04), Vector3(0.39, 1.85, 0.45), accent_material, "sphere")
	_add_accessory(accent_material, cream_material)

func _process(delta: float) -> void:
	_time += delta
	if not is_instance_valid(_body_root):
		return
	_body_root.position.y = sin(_time * (7.0 if walking else 2.2)) * (0.035 if walking else 0.018)
	if is_instance_valid(_hero_sprite):
		_hero_sprite.position.x = sin(_time * (8.0 if walking else 1.8)) * (0.025 if walking else 0.008)
		_hero_sprite.scale.x = 1.0 + (0.018 if walking else 0.0) * sin(_time * 8.0)
		return
	var swing := sin(_time * 8.0) * 0.48 if walking else sin(_time * 1.8) * 0.04
	if is_instance_valid(_left_arm):
		_left_arm.rotation.x = swing
		_right_arm.rotation.x = -swing
		_left_leg.rotation.x = -swing * 0.65
		_right_leg.rotation.x = swing * 0.65

func _part(label: String, size: Vector3, at: Vector3, material: Material, kind: String) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	part.name = label
	var mesh: PrimitiveMesh
	if kind == "capsule":
		var capsule := CapsuleMesh.new()
		capsule.radius = 0.5
		capsule.height = 1.0
		capsule.radial_segments = 12
		capsule.rings = 4
		mesh = capsule
	else:
		var sphere := SphereMesh.new()
		sphere.radial_segments = 16
		sphere.rings = 8
		mesh = sphere
	part.mesh = mesh
	part.scale = size
	part.position = at
	part.material_override = material
	_body_root.add_child(part)
	return part

func _add_accessory(accent: Material, cream: Material) -> void:
	match config.accessory:
		&"sprout":
			_part("SproutStem", Vector3(0.09, 0.32, 0.09), Vector3(0, 2.63, 0), accent, "capsule")
			_part("SproutLeaf", Vector3(0.3, 0.12, 0.18), Vector3(0.19, 2.76, 0), accent, "sphere")
		&"star":
			_part("StarCharm", Vector3(0.22, 0.22, 0.1), Vector3(0.42, 2.31, 0.2), cream, "sphere")
		_:
			_part("FlowerCenter", Vector3(0.17, 0.17, 0.12), Vector3(0.42, 2.31, 0.2), cream, "sphere")
			for angle in [0.0, TAU / 3.0, TAU * 2.0 / 3.0]:
				_part("Petal", Vector3(0.18, 0.11, 0.1), Vector3(0.42 + cos(angle) * 0.18, 2.31 + sin(angle) * 0.18, 0.19), accent, "sphere")

func _material(color: Color, roughness: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = roughness
	material.metallic = 0.05
	return material
