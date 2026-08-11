# Continuity Test — Vietnamese — `deepseek-v4-pro`

**Case**: `vi-romance-01`. **Run through**: the real `submitTurn`/`InMemoryTurnRepository`
pipeline. Post thinking-mode-fix. This case has explicit dialogue exchanges, unlike the EN
continuity sample, so forms-of-address drift can actually be assessed here.

**Note on character identity**: as with the EN sample, the model invented its own characters
("Mai" the illustrator, "Huy" the editor) rather than the Golden Set's designed "Thảo Chi" — see
`character-identity-architecture-gap.md`. Because the invented editor is male, the natural
reciprocal address pair is "anh"/"em", not the Golden Set's designed "chị"/"em" — this is a
sensible adaptation to the self-invented gender, not a mismatch against an instruction the model
was actually given.

## Turn 1 (start)

> Căn phòng họp nhỏ của nhà xuất bản Ánh Sáng ngập tràn mùi giấy cũ và mực in. Trên bàn, hàng chục bản thảo minh họa vương vãi, những đường nét mềm mại, màu sắc dịu dàng. Mai – họa sĩ minh họa với mái tóc buộc hờ, áo len rộng – đang chăm chú tô lại một chi tiết nhỏ, gần như không để ý đến người vừa bước vào. Tiếng giày cao gót vang lên sắc lạnh. "Bản thảo này vẫn chưa đâu vào đâu. Ba tuần, không thêm ngày nào." – giọng nói vang lên, cắt ngang dòng suy nghĩ. Đó là Huy, biên tập viên mới, nổi tiếng khó tính... "Nét vẽ thì đẹp, nhưng câu chuyện không có hồn... Em cần hiểu chúng muốn gì." Mai ngước lên, nụ cười nhạt trên môi. "Anh nói cứ như mình từng là trẻ con vậy."

## Turn 2 (custom action: the Golden Set case's designed initial decision)

> Mai thả lỏng vai... "Được rồi, anh nói câu chuyện không có hồn. Vậy cụ thể thì điều gì trong bản phác thảo khiến anh không hài lòng?" – Mai hỏi... Huy khựng lại một thoáng... "Mọi thứ. Từ cách em bố cục, màu sắc cho đến biểu cảm nhân vật. Nó đẹp, nhưng xa cách..."

## Turn 3 (generic continuation)

> Mai cúi xuống nhìn bức vẽ chú thỏ... "Có lẽ... tôi đã quên mất cảm giác làm một đứa trẻ. Cảm ơn anh, dù cách nói của anh có hơi... thẳng." – cô nói, giọng dịu dàng hơn. Huy bất ngờ... "Tôi không giỏi vòng vo. Nhưng nếu em đã sẵn sàng lắng nghe, chúng ta có thể bắt đầu lại từ đầu..."

(Full turn text is longer than the excerpts above; see `bakeoff-results.json`'s companion raw
capture for the complete transcript if needed — trimmed here for readability.)

## Continuity assessment

**Deadline fact**: PASS. "Ba tuần" (three weeks) established in turn 1 is referenced consistently
in the recorded canon facts and never contradicted across the transcript.

**Forms of address**: **mostly consistent, one point flagged for human review, not asserted as a
defect.** Huy consistently addresses Mai as "em" across turns 1–2. Mai consistently addresses Huy as
"anh" in turns 2–3. In turn 3, during an emotional-vulnerability beat, **both characters briefly
self-refer as "tôi"** instead of "em"/"anh" ("tôi đã quên mất cảm giác...", "Tôi không giỏi vòng
vo"). Vietnamese speech naturally shifts toward more neutral/formal self-reference during a
vulnerable or reflective moment, so this may be an intentional, natural register shift rather than
an ungrounded contradiction — the Golden Set's own prohibited-contradiction wording is specifically
about the address pair changing "một cách vô cớ" (without narrative cause), and there is a
narrative cause here (the emotional breakthrough). This is exactly the kind of nuanced judgment
call the task brief reserves for human/native-speaker review rather than automated verdict — flagged
here, not resolved.
