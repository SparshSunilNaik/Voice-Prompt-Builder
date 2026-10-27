import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { App } from './App'

test('renders typed and voice entry points', () => {
  render(<App />)
  expect(screen.getByRole('textbox', { name: /rough prompt/i })).toBeVisible()
  expect(screen.getByRole('button', { name: /record idea/i })).toBeVisible()
})
