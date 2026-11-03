export type DoorScenarioId = "charm" | "password";

export type DoorScenario = {
  id: DoorScenarioId;
  label: string;
  intro: string;
  challenge: string;
  success: string;
  choices?: Array<{ label: string; correct: boolean }>;
};

export const doorScenarios: Record<DoorScenarioId, DoorScenario> = {
  charm: {
    id: "charm",
    label: "오늘의 귀여움 심사",
    intro: "잠깐. 오늘 밤 클럽은 귀여움 심사가 있어.",
    challenge: "말로는 부족하지. 네 최고의 카피바라 애교를 보여줘.",
    success: "……이건 반칙인데. 합격. DJ 밤톨이 기다린대.",
  },
  password: {
    id: "password",
    label: "오늘의 비밀 암호",
    intro: "오늘은 단골 테스트야. 암호를 알아야 문이 열려.",
    challenge: "힌트는 카피바라가 춤출 때 내는 소리. 순서가 중요해.",
    success: "정답. 꾸물할 줄 아는 친구였군. 들어가.",
    choices: [
      { label: "꾸물꾸물 둠칫둠칫", correct: true },
      { label: "번쩍번쩍 찰랑찰랑", correct: false },
      { label: "맥주 두 잔 주세요", correct: false },
    ],
  },
};
