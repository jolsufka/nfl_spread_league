import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders NFL pick-em app title', () => {
  render(<App />);
  const titleElement = screen.getByText(/2025-26 NFL Spread Pick-Em/i);
  expect(titleElement).toBeInTheDocument();
});
