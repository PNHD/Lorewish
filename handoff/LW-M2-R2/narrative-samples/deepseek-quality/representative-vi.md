# DeepSeek Quality Tier (`deepseek-v4-pro`) — Representative Vietnamese Sample

**Case**: `vi-fantasy-01` — same case used across all four candidates for direct comparison. This
specific case is also the one documented in `notable-findings/deepseek-thinking-mode-bug.md` as
the case that first exposed the thinking-mode bug (it consistently failed structurally before that
fix, and passes reliably after it) — included here specifically to show the corrected behavior on
the same case, not a different, easier one.

**Status**: full text, generated after the thinking-mode fix. Part of the fully clean post-fix
12/12 bakeoff run.

**Full narrative**:

> Bạn rút tập giấy tờ từ túi áo, đưa cho vị tướng với vẻ bình tĩnh nhất có thể. Ngọn đuốc trong tay ông ta nhảy múa, hắt bóng lên gương mặt khắc khổ. Ông ta liếc qua con dấu, đôi mắt vẫn đầy vẻ ngờ vực. "Giấy tờ có vẻ hợp lệ... nhưng ta vẫn không hiểu tại sao một pháp sư trẻ lại được giao viên ngọc quan trọng đến vậy." Bạn hít một hơi, nhận ra đây là cơ hội để giải thích, nhưng cũng là canh bạc nếu lời nói không thuyết phục.

**Structural result**: PASS, no repair required.

**Metadata**: input tokens 540, output tokens 697, cost 841 micro-dollars ($0.000841), latency 11966ms.

**Note**: natural, native-register Vietnamese with in-character dialogue reflecting the general's
suspicion ("ta vẫn không hiểu tại sao..."), consistent forms of address for a wary military
authority figure. No detectable translated-from-English phrasing.
