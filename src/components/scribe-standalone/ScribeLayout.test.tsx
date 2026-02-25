import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ScribeLayout } from './ScribeLayout';

describe('ScribeLayout', () => {
  it('renders the DocAssist Scribe brand name', () => {
    render(
      <MemoryRouter initialEntries={['/scribe/dashboard']}>
        <Routes>
          <Route path="/scribe/*" element={<ScribeLayout />}>
            <Route path="dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getAllByText(/DocAssist Scribe/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders child route content via Outlet', () => {
    render(
      <MemoryRouter initialEntries={['/scribe/dashboard']}>
        <Routes>
          <Route path="/scribe/*" element={<ScribeLayout />}>
            <Route path="dashboard" element={<div>My Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('My Dashboard Content')).toBeInTheDocument();
  });
});
