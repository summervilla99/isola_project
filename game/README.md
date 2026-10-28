# ISOLA game client

Godot 4.7 기반 iOS·Android 모바일 게임 클라이언트다. 기존 Next.js PWA와 Supabase 데이터베이스는 루트에 보존한다.

## 로컬 실행

```sh
godot --editor --path game
```

현재 수직 구현은 16:9 가로 화면에서 다음 흐름을 제공한다.

1. 섬과 브랜드를 게임 전체 화면으로 보여준다.
2. 사람·카피바라·정령 기본형과 색을 선택한다.
3. 공통 2족 골격 캐릭터로 섬에 도착한다.
4. 데스크톱 개발 실행에서는 WASD/방향키로 산책한다.
5. 모바일 조이스틱으로 이동하고 첫 집의 분위기를 고른다.
6. 소파·책장·화분을 놓고 회전·제거한 뒤 로컬 초안을 저장한다.

화면 검수용으로 특정 단계에서 바로 시작할 수 있다.

```sh
godot --path game -- --preview-theme
godot --path game -- --preview-room=toy
```

## 검증

```sh
godot --headless --path game --editor --quit
godot --headless --path game --script res://tests/test_avatar_config.gd
```

모바일 내보내기는 별도 export template과 서명 설정이 필요하다. 비밀 키는 프로젝트 파일에 저장하지 않는다.
