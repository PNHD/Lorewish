# Gemini Quality Tier (`gemini-3.6-flash`) — Representative Vietnamese Sample

**Case**: `vi-fantasy-01` — a young mage escorting the last wardstone to the capital is stopped by a border general.

**Status**: full text, generated **after** both fixes (language_mixing false-positive fix and
thinking-token cost-accounting fix) landed. Captured via a single ad-hoc generation (not from the
2-pass structural bakeoff, since `gemini-3.6-flash`'s daily quota was exhausted before a clean full
pass could run — see COMPARISON.md) but produced by the exact same adapter code path.

**Full narrative**:

> Ánh đuốc bập bùng chiếu lên gương mặt góc cạnh, đầm đìa sương đêm của Tướng quân Lý Trịnh. Bạn cẩn thận bước tiến một bước, giơ cao cuộn giấy có ấn phong niêm màu tím của Đại Thượng viện. Dưới cái nhìn sắc như dao cạo của vị tướng cùng hàng chục mũi giáo đang chĩa về phía mình, bạn giữ giọng bình tĩnh, giải thích chi tiết về nguy cơ biên giới phía bắc sụp đổ và tầm quan trọng của viên ngọc trấn yểm. Tướng Lý Trịnh cau mày, ngón tay miết nhẹ lên triện đồng trên cuộn giấy, vẻ nghi hoặc trong mắt ông vẫn chưa tan hẳn.

**Structural result**: PASS (no `language_mixing` false positive — this exact generation's text
was the real-world repro used to write the quality-gate regression test).

**Metadata**: input tokens 300, output tokens 625 (visible + thinking, corrected accounting),
estimated cost 5138 micro-dollars ($0.005138), latency 9393ms.

**Note on naturalness**: this excerpt reads as fluent, native-register Vietnamese wuxia/fantasy
prose — proper forms of military address ("Tướng quân"), period-appropriate imagery ("ấn phong niêm
màu tím", "triện đồng"), no detectable translated-from-English sentence structure. Human reviewer
judgment on naturalness is still required — this is a structural/technical note, not a quality
verdict.
