import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Loading } from './Loading.jsx';

describe('Loading', () => {
  it('render thông báo Đang tải dữ liệu', () => {
    render(<Loading />);
    expect(screen.getByText('Đang tải dữ liệu…')).toBeInTheDocument();
  });

  it('gắn class loading', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.loading')).not.toBeNull();
  });
});
