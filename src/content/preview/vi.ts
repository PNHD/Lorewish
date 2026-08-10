import type { PreviewFixture } from "./types";

// Viết độc lập cho tiếng Việt, không dịch từng câu từ bản tiếng Anh — cùng
// một ý đồ cảnh, cùng hệ quả các lựa chọn, nhưng lối hành văn và nhịp câu là
// của tiếng Việt (docs/NARRATIVE_QUALITY_CONTRACT.md mục E).
export const previewFixtureVi: PreviewFixture = {
  startNodeId: "start",
  nodes: {
    start: {
      id: "start",
      boundaryKind: "none",
      narrative: [
        "Cánh cổng làng Sương Hồ kẽo kẹt mở sau lưng, và tiếng chợ ùa ra đón bạn — khói bếp, tiếng người rao hàng, một la bàn vẽ nguệch ngoạc trên phiến đá nứt phía trên giếng làng. Trong túi bạn chỉ có đúng một đồng xu, và bạn chẳng biết đường nào dẫn về nhà.",
      ],
      choices: [
        { id: "to-market", label: "Đi theo tiếng ồn vào chợ", nextId: "market" },
        { id: "to-guard", label: "Hỏi đường người lính gác cổng", nextId: "guard" },
      ],
      customActionTargetId: "custom",
    },
    market: {
      id: "market",
      boundaryKind: "checkpoint",
      playerAction: "Bạn đi theo tiếng ồn vào chợ.",
      narrative: [
        "Giữa sạp gia vị và lồng chim câu đang giãy giụa, một bà lão nắm lấy tay áo bạn. \"Nhìn là biết cháu không rành đường rồi,\" bà nói, giọng chẳng có ý trách. \"Bà chỉ đường cho — đổi lấy một câu chuyện thôi.\" Bà liếc đồng xu trong tay bạn như thể nó chẳng đáng gì với bà cả.",
      ],
      dialogue: [
        { speaker: "Bà lão ở chợ", line: "Kể bà nghe một chuyện, bà chỉ đường cho, đường đúng hẳn hoi." },
      ],
      stateChange: ["Gặp: Bà lão ở chợ", "Ghi nhận: bà đổi đường lấy một câu chuyện"],
      continueTargetId: "ending",
      customActionTargetId: "ending",
    },
    guard: {
      id: "guard",
      boundaryKind: "checkpoint",
      playerAction: "Bạn hỏi đường người lính gác cổng.",
      narrative: [
        "Người lính không ngẩng đầu khỏi lưỡi kiếm đang mài. \"Nhà là một chữ, chưa phải một chốn, cho tới khi cháu nói rõ nhà của ai,\" anh ta lầm bầm — rồi dịu giọng khi thấy vẻ mặt bạn. \"Đường lớn rẽ ở giếng cổ. Trái là lên đồi. Phải là đi khắp thiên hạ.\" Anh ta hất cằm về phía ngã ba như thể đã chán phải nói chuyện với bạn.",
      ],
      dialogue: [{ speaker: "Người lính gác cổng", line: "Trái lên đồi, phải đi khắp thiên hạ. Đừng bắt tôi nói lại." }],
      stateChange: ["Biết: đường rẽ ở giếng cổ", "Quan hệ — Người lính gác cổng: dè dặt"],
      continueTargetId: "ending",
      customActionTargetId: "ending",
    },
    custom: {
      id: "custom",
      boundaryKind: "checkpoint",
      narrative: [
        "Dù bạn quyết định thế nào, làng Sương Hồ cũng chẳng đợi bạn nghĩ cho xong. Một chiếc xe kéo rầm rầm chạy qua, ai đó rao giá thứ gì đó giữa không trung, còn bà lão bên giếng nghiêng đầu nhìn bạn như thể đã biết trước bạn sắp hỏi gì.",
      ],
      stateChange: ["Ghi nhận: hành động trước, hỏi han sau"],
      continueTargetId: "ending",
      customActionTargetId: "ending",
    },
    ending: {
      id: "ending",
      boundaryKind: "ending",
      playerAction: "Bạn tiếp tục lên đường.",
      narrative: [
        "Khi nắng vừa lên khỏi mái nhà, bạn đã có sẵn một câu chuyện đáng kể — mà ở Sương Hồ, thế cũng quý như tiền. Đường về nhà có đợi thêm một giờ cũng chẳng sao.",
      ],
    },
  },
};
