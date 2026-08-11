import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { radius, spacing } from "@/theme/tokens";
import { focusRingStyle, hoverBorderColor, hoverSurfaceTint, type PressableVisualState } from "@/theme/interactive";
import { useAppTheme } from "@/theme/use-app-theme";

import {
  ADDRESS_PRESETS,
  type AddressPresetId,
  type NarrativePov,
  type SetupErrorKey,
  type StorySetupDraft,
  type Tone,
} from "./model";
import { SetupTextField } from "./setup-text-field";

function OptionRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            onPress={() => onChange(option.id)}
            style={(state: PressableVisualState) => [
              {
                borderWidth: 1,
                borderColor: hoverBorderColor(state, colors, selected),
                backgroundColor: selected ? colors.accent : colors.surface,
                borderRadius: radius.pill,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.md,
              },
              focusRingStyle(state, colors),
            ]}
          >
            <ThemedText variant="label" color={selected ? "onAccent" : "primary"}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function DisclosureSection({ title, initiallyOpen = false, children }: { title: string; initiallyOpen?: boolean; children: ReactNode }) {
  const { colors, mode } = useAppTheme();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={(state: PressableVisualState) => [
          {
            flexDirection: "row" as const,
            justifyContent: "space-between" as const,
            alignItems: "center" as const,
            borderRadius: radius.sm,
            marginHorizontal: -spacing.xs,
            paddingHorizontal: spacing.xs,
            paddingVertical: spacing.xs / 2,
            backgroundColor: hoverSurfaceTint(state, mode),
          },
          focusRingStyle(state, colors),
        ]}
      >
        <ThemedText variant="heading">{title}</ThemedText>
        <ThemedText variant="label" color="secondary">{open ? "−" : "+"}</ThemedText>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

export function AdvancedSetupForm({
  draft,
  update,
  errors,
  copy,
}: {
  draft: StorySetupDraft;
  update: <K extends keyof StorySetupDraft>(key: K, value: StorySetupDraft[K]) => void;
  errors: Partial<Record<SetupErrorKey, true>>;
  copy: Record<string, string>;
}) {
  return (
    <View style={{ gap: spacing.xl }}>
      <DisclosureSection title={copy.storySection} initiallyOpen>
        <View style={{ gap: spacing.md }}>
        <SetupTextField label={copy.premise} value={draft.premise} onChangeText={(value) => update("premise", value)} placeholder={copy.premisePlaceholder} required multiline maxLength={4000} error={errors.premise ? copy.requiredError : undefined} />
        <SetupTextField label={copy.worldSetting} value={draft.worldSetting} onChangeText={(value) => update("worldSetting", value)} placeholder={copy.worldPlaceholder} multiline maxLength={4000} />
        <ThemedText variant="label">{copy.tone}</ThemedText>
        <OptionRow<Tone> value={draft.tone} onChange={(value) => update("tone", value)} options={[
          { id: "light", label: copy.toneLight },
          { id: "balanced", label: copy.toneBalanced },
          { id: "dark", label: copy.toneDark },
        ]} />
        <ThemedText variant="label">{copy.pov}</ThemedText>
        <OptionRow<NarrativePov> value={draft.narrativePov} onChange={(value) => update("narrativePov", value)} options={[
          { id: "first_person", label: copy.povFirst },
          { id: "second_person", label: copy.povSecond },
          { id: "third_person", label: copy.povThird },
        ]} />
        </View>
      </DisclosureSection>

      <DisclosureSection title={copy.playerSection}>
        <View style={{ gap: spacing.md }}>
        <SetupTextField label={copy.playerRole} value={draft.playerRole} onChangeText={(value) => update("playerRole", value)} placeholder={copy.playerRolePlaceholder} required maxLength={1000} error={errors.playerRole ? copy.requiredError : undefined} />
        <SetupTextField label={copy.playerName} value={draft.playerName} onChangeText={(value) => update("playerName", value)} placeholder={copy.optionalPlaceholder} maxLength={200} />
        <SetupTextField label={copy.playerDescription} value={draft.playerDescription} onChangeText={(value) => update("playerDescription", value)} placeholder={copy.playerDescriptionPlaceholder} multiline maxLength={2000} />
        </View>
      </DisclosureSection>

      <DisclosureSection title={copy.characterSection}>
        <View style={{ gap: spacing.md }}>
        <SetupTextField label={copy.characterName} value={draft.characterName} onChangeText={(value) => update("characterName", value)} placeholder={copy.characterNamePlaceholder} required maxLength={200} error={errors.characterName ? copy.requiredError : undefined} />
        <SetupTextField label={copy.characterRole} value={draft.characterRole} onChangeText={(value) => update("characterRole", value)} placeholder={copy.characterRolePlaceholder} required maxLength={500} error={errors.characterRole ? copy.requiredError : undefined} />
        <SetupTextField label={copy.characterDescription} value={draft.characterDescription} onChangeText={(value) => update("characterDescription", value)} placeholder={copy.characterDescriptionPlaceholder} multiline maxLength={2000} />
        <SetupTextField label={copy.characterRelationship} value={draft.characterRelationship} onChangeText={(value) => update("characterRelationship", value)} placeholder={copy.characterRelationshipPlaceholder} required maxLength={500} error={errors.characterRelationship ? copy.requiredError : undefined} />
        <SetupTextField label={copy.aliases} value={draft.characterAliases} onChangeText={(value) => update("characterAliases", value)} placeholder={copy.aliasesPlaceholder} maxLength={1000} />
        </View>
      </DisclosureSection>

      {draft.contentLanguage === "vi" ? (
        <DisclosureSection title={copy.addressSection}>
          <View style={{ gap: spacing.md }}>
          <ThemedText variant="body" color="secondary">{copy.addressHint}</ThemedText>
          <OptionRow<AddressPresetId>
            value={draft.addressPreset}
            onChange={(value) => update("addressPreset", value)}
            options={(Object.keys(ADDRESS_PRESETS) as AddressPresetId[]).map((id) => ({
              id,
              label: id === "anh_em" ? "anh / em" : id === "chi_em" ? "chị / em" : id === "toi_cau" ? "tôi / cậu" : "ta / ngươi",
            }))}
          />
          {/* Four labeled rows, not a bare joined string (LW-W5-R1 P0-2) — the
              preset resolves to two same-language pronouns used in two
              different roles (e.g. "tôi" as both the player's and the
              character's self-reference), which is unrecoverable from a
              plain `Object.values().join()`. */}
          <View style={{ gap: spacing.xs }}>
            {(
              [
                ["addressCharacterCallsYou", "targetAddressesSpeakerAs"],
                ["addressCharacterCallsSelf", "targetSelfReference"],
                ["addressYouCallCharacter", "speakerAddressesTargetAs"],
                ["addressYouCallSelf", "speakerSelfReference"],
              ] as const
            ).map(([labelKey, field]) => (
              <View key={field} style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                <ThemedText variant="caption" color="secondary">{copy[labelKey]}</ThemedText>
                <ThemedText variant="label">{ADDRESS_PRESETS[draft.addressPreset][field]}</ThemedText>
              </View>
            ))}
          </View>
          </View>
        </DisclosureSection>
      ) : null}
    </View>
  );
}
