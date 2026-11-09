import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { PromptReview } from './WorkflowViews'

test('final prompt remains editable and insertion requires its dedicated approval control', () => {
  const change = vi.fn()
  const insert = vi.fn()
  const copy = vi.fn()
  render(<PromptReview prompt="Initial prompt" assumptions={[]} onChange={change} onBack={() => undefined} onRegenerate={() => undefined} onCopy={copy} onInsert={insert} />)
  fireEvent.change(screen.getByRole('textbox', { name: /final prompt/i }), { target: { value: 'Edited prompt' } })
  fireEvent.click(screen.getByRole('button', { name: /approve & insert/i }))
  expect(change).toHaveBeenCalledWith('Edited prompt')
  expect(insert).toHaveBeenCalledOnce()
  expect(copy).not.toHaveBeenCalled()
})
