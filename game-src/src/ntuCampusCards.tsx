import type { INTERNAL_Snapshot as Snapshot } from 'valtio'
import type { CardKind, Lang, LoopState } from './alwaysOnLoop'
import './ntuCampusCards.css'

type Props = {
  state: Snapshot<LoopState>, language: Lang
  formatTime: (at: number) => string
  onAnswer: (card: string, action: string) => void
  /** The card and action the demo director is about to choose, drawn as pressed. */
  pressing?: { card: string, action: string }
}
const KIND: Record<CardKind, readonly [string, string, string]> = {
  reminder: ['⏰', 'Reminder', '提醒'], confirm: ['?', 'Please confirm', '请你确认'], message: ['✉', 'Message', '消息'], review: ['☰', 'Review', '复盘'], plan: ['☀', 'Plan', '计划']
}
/** A card held back because others are around: no content, only that it exists. */
const PRIVATE = ['🔒', 'Private', '私人'] as const
/** Number keys answer the newest card, so reminders can be handled without leaving mouse-look. */
export const CARD_KEYS = ['Digit1', 'Digit2', 'Digit3'] as const
const stop = (event: { stopPropagation: () => void }) => event.stopPropagation()

/**
 * Explicit reminders: whatever the glasses say without being asked appears here, with
 * what it is, why now, and which memory it relies on. It never blocks walking.
 */
export default function NtuCampusCards ({ state, language, formatTime, onAnswer, pressing }: Props) {
  const zh = language === 'zh'
  // The newest card in full, the one before it folded; the rest are counted on the newest.
  const all = [...state.action.cards].reverse()
  const cards = all.slice(0, 2)
  if (!cards.length) return null
  return <div className='ntu-cards ao-interactive' aria-live='polite' onPointerDown={stop} onMouseDown={stop}>{cards.map((card, index) => {
    const basis = card.basis ? state.memory.find(record => record.id === card.basis) : undefined
    const [icon, en, cn] = card.private ? PRIVATE : KIND[card.kind]
    const newest = index === 0
    return <article key={`${card.id}@${card.at}`} className='ntu-card' data-kind={card.kind} data-private={card.private} data-newest={newest} role='group' aria-label={card.title[language]}>
      <header><i aria-hidden='true'>{icon}</i><b>{zh ? `眼镜 · ${cn}` : `Glasses · ${en}`}</b>{newest && all.length > 1 && <em className='ntu-card-more' data-hidden={all.length - cards.length}>{zh ? `还有 ${all.length - 1} 张` : `+${all.length - 1} more`}</em>}<time>{formatTime(card.at)}</time></header>
      <h3>{card.title[language]}</h3>
      {newest && card.lines && <ul>{card.lines.map(line => <li key={line.en}>{line[language]}</li>)}</ul>}
      {newest && card.why && <p><b>{zh ? '为什么是现在' : 'Why now'}</b>{card.why[language]}</p>}
      {newest && basis && <p><b>{zh ? '依据' : 'Based on'}</b>{zh ? '记忆里的' : 'Memory · '}“{basis.label[language]}”<small>{basis.source === 'M' ? '' : basis.source.replaceAll(' ', '')} · {formatTime(basis.at)}</small></p>}
      <div className='ntu-card-actions'>{card.actions.map((action, key) => <button key={action.id} data-primary={action.primary} data-pressed={pressing?.card === card.id && pressing.action === action.id} onClick={() => onAnswer(card.id, action.id)}>
        {newest && <kbd>{key + 1}</kbd>}{action.label[language]}
      </button>)}</div>
    </article>
  })}</div>
}
