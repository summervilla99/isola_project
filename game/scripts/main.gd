extends Node3D

enum Screen { WELCOME, CREATOR, ISLAND }

const PINK := Color("#ff5b9d")
const PURPLE := Color("#6f59ff")
const INK := Color("#30264b")
const CREAM := Color("#fff7df")

var world: IslandWorld
var config := AvatarConfig.new()
var overlay: Control
var sheet: PanelContainer
var title_label: Label
var subtitle_label: Label
var primary_button: Button
var current_screen := Screen.WELCOME
var species_row: HBoxContainer
var palette_row: HBoxContainer

func _ready() -> void:
	seed(42)
	world = IslandWorld.new()
	world.name = "IslandWorld"
	add_child(world)
	_build_ui()
	_show_welcome()

func _build_ui() -> void:
	overlay = Control.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(overlay)

	var top_bar := HBoxContainer.new()
	top_bar.position = Vector2(22, 20)
	top_bar.size = Vector2(346, 52)
	top_bar.add_theme_constant_override("separation", 8)
	overlay.add_child(top_bar)
	var logo := Label.new()
	logo.text = "✦  ISOLA"
	logo.add_theme_font_size_override("font_size", 21)
	logo.add_theme_color_override("font_color", Color.WHITE)
	logo.add_theme_constant_override("outline_size", 7)
	logo.add_theme_color_override("font_outline_color", Color("#714f88"))
	logo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top_bar.add_child(logo)
	var settings := Button.new()
	settings.text = "⋯"
	settings.custom_minimum_size = Vector2(48, 44)
	_style_button(settings, Color("#fff4d8"), INK, 22)
	top_bar.add_child(settings)

	sheet = PanelContainer.new()
	sheet.position = Vector2(16, 512)
	sheet.size = Vector2(358, 316)
	sheet.add_theme_stylebox_override("panel", _panel_style(CREAM, 28, 5, Color("#3d315c")))
	overlay.add_child(sheet)

func _show_welcome() -> void:
	current_screen = Screen.WELCOME
	world.set_play_mode(false)
	_clear_sheet()
	var content := _sheet_content()
	var badge := Label.new()
	badge.text = "  친구들과 사는 작은 낙원  "
	badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	badge.add_theme_font_size_override("font_size", 13)
	badge.add_theme_color_override("font_color", PURPLE)
	content.add_child(badge)
	title_label = Label.new()
	title_label.text = "너는 어떤 존재로\n이 섬에 올래?"
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.add_theme_font_size_override("font_size", 30)
	title_label.add_theme_color_override("font_color", INK)
	content.add_child(title_label)
	subtitle_label = Label.new()
	subtitle_label.text = "사람이어도, 카피바라여도,\n아직 이름 없는 정령이어도 좋아."
	subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle_label.add_theme_font_size_override("font_size", 15)
	subtitle_label.add_theme_color_override("font_color", Color("#685b79"))
	content.add_child(subtitle_label)
	primary_button = Button.new()
	primary_button.text = "내 존재 만들기  →"
	primary_button.custom_minimum_size = Vector2(0, 58)
	_style_button(primary_button, PINK, Color.WHITE, 17)
	primary_button.pressed.connect(_show_creator)
	content.add_child(primary_button)

func _show_creator() -> void:
	current_screen = Screen.CREATOR
	_clear_sheet()
	sheet.position.y = 438
	sheet.size.y = 390
	var content := _sheet_content()
	var heading := Label.new()
	heading.text = "나만의 존재 조립하기"
	heading.add_theme_font_size_override("font_size", 24)
	heading.add_theme_color_override("font_color", INK)
	content.add_child(heading)
	var hint := Label.new()
	hint.text = "종족은 시작점일 뿐, 무엇이든 섞을 수 있어요."
	hint.add_theme_font_size_override("font_size", 13)
	hint.add_theme_color_override("font_color", Color("#766682"))
	content.add_child(hint)

	content.add_child(_section_label("기본 모습"))
	species_row = HBoxContainer.new()
	species_row.add_theme_constant_override("separation", 7)
	for entry in [[&"human", "사람"], [&"capybara", "카피바라"], [&"spirit", "정령"]]:
		var button := Button.new()
		button.text = entry[1]
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size.y = 43
		_style_button(button, PINK if config.species == entry[0] else Color("#eadffc"), Color.WHITE if config.species == entry[0] else INK, 14)
		button.pressed.connect(_select_species.bind(entry[0]))
		species_row.add_child(button)
	content.add_child(species_row)

	content.add_child(_section_label("말랑한 색"))
	palette_row = HBoxContainer.new()
	palette_row.alignment = BoxContainer.ALIGNMENT_CENTER
	palette_row.add_theme_constant_override("separation", 11)
	for index in AvatarConfig.PALETTES.size():
		var swatch := Button.new()
		swatch.text = "●"
		swatch.custom_minimum_size = Vector2(48, 44)
		_style_button(swatch, AvatarConfig.PALETTES[index], Color.WHITE, 21)
		swatch.pressed.connect(_select_palette.bind(index))
		palette_row.add_child(swatch)
	content.add_child(palette_row)

	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 9)
	var random_button := Button.new()
	random_button.text = "✦ 랜덤 믹스"
	random_button.custom_minimum_size = Vector2(112, 55)
	_style_button(random_button, Color("#ffd55c"), INK, 14)
	random_button.pressed.connect(_randomize_avatar)
	actions.add_child(random_button)
	var enter_button := Button.new()
	enter_button.text = "이 모습으로 도착하기  →"
	enter_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	enter_button.custom_minimum_size.y = 55
	_style_button(enter_button, PURPLE, Color.WHITE, 14)
	enter_button.pressed.connect(_enter_island)
	actions.add_child(enter_button)
	content.add_child(actions)

func _enter_island() -> void:
	current_screen = Screen.ISLAND
	world.set_play_mode(true)
	_clear_sheet()
	sheet.position = Vector2(16, 710)
	sheet.size = Vector2(358, 118)
	var content := _sheet_content(12)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	var message := Label.new()
	message.text = "ISOLA에 도착했어요!\nWASD로 섬을 산책해봐요."
	message.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	message.add_theme_font_size_override("font_size", 15)
	message.add_theme_color_override("font_color", INK)
	row.add_child(message)
	var wave := Button.new()
	wave.text = "안녕! ♡"
	wave.custom_minimum_size = Vector2(92, 66)
	_style_button(wave, PINK, Color.WHITE, 14)
	row.add_child(wave)
	content.add_child(row)

func _select_species(value: StringName) -> void:
	config.set_species(value)
	world.avatar.apply_config(config)
	_show_creator()

func _select_palette(index: int) -> void:
	config.set_palette(index)
	world.avatar.apply_config(config)

func _randomize_avatar() -> void:
	config.randomize()
	world.avatar.apply_config(config)
	_show_creator()

func _clear_sheet() -> void:
	for child in sheet.get_children():
		child.queue_free()

func _sheet_content(padding: int = 18) -> VBoxContainer:
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", padding)
	margin.add_theme_constant_override("margin_top", padding)
	margin.add_theme_constant_override("margin_right", padding)
	margin.add_theme_constant_override("margin_bottom", padding)
	sheet.add_child(margin)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 10)
	margin.add_child(content)
	return content

func _section_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", 13)
	label.add_theme_color_override("font_color", Color("#756484"))
	return label

func _style_button(button: Button, background: Color, foreground: Color, font_size: int) -> void:
	button.add_theme_font_size_override("font_size", font_size)
	button.add_theme_color_override("font_color", foreground)
	button.add_theme_color_override("font_hover_color", foreground)
	button.add_theme_color_override("font_pressed_color", foreground)
	button.add_theme_stylebox_override("normal", _panel_style(background, 16, 0, Color.TRANSPARENT))
	button.add_theme_stylebox_override("hover", _panel_style(background.lightened(0.08), 16, 0, Color.TRANSPARENT))
	button.add_theme_stylebox_override("pressed", _panel_style(background.darkened(0.08), 16, 0, Color.TRANSPARENT))

func _panel_style(color: Color, radius: int, border_width: int, border_color: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.corner_radius_top_left = radius
	style.corner_radius_top_right = radius
	style.corner_radius_bottom_left = radius
	style.corner_radius_bottom_right = radius
	style.border_width_left = border_width
	style.border_width_top = border_width
	style.border_width_right = border_width
	style.border_width_bottom = border_width
	style.border_color = border_color
	style.shadow_color = Color(0.15, 0.08, 0.25, 0.22)
	style.shadow_size = 9
	style.shadow_offset = Vector2(0, 5)
	return style
