import type { RunProfile } from '@browseros/shared/schemas/runtime'
import type { FC } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ChatMode } from './chatTypes'

const RUN_PROFILE_META: Record<RunProfile, { label: string }> = {
  ask: {
    label: 'Ask',
  },
  do: {
    label: 'Do',
  },
  research: {
    label: 'Research',
  },
  build: {
    label: 'Build',
  },
  watch: {
    label: 'Watch',
  },
}

const CHAT_PROFILES: RunProfile[] = ['ask', 'research']
const AGENT_PROFILES: RunProfile[] = ['do', 'research', 'build', 'watch', 'ask']

interface RunProfileSelectProps {
  mode: ChatMode
  runProfile: RunProfile
  onRunProfileChange: (runProfile: RunProfile) => void
}

export const RunProfileSelect: FC<RunProfileSelectProps> = ({
  mode,
  runProfile,
  onRunProfileChange,
}) => {
  const options = mode === 'chat' ? CHAT_PROFILES : AGENT_PROFILES

  return (
    <Select
      value={runProfile}
      onValueChange={(value) => onRunProfileChange(value as RunProfile)}
    >
      <SelectTrigger
        size="sm"
        className="h-8 rounded-full border-border/50 bg-muted/30 px-3 text-xs"
      >
        <SelectValue placeholder="Profile">
          {RUN_PROFILE_META[runProfile].label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((profile) => (
          <SelectItem key={profile} value={profile}>
            {RUN_PROFILE_META[profile].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
