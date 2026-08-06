import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Status, Stat } from './Status.jsx';

describe('Status', () => {
  it('render nhãn tiếng Việt cho state đã biết', () => {
    render(<Status value="cho_tiep_nhan" />);
    expect(screen.getByText('Chờ tiếp nhận')).toBeInTheDocument();
  });

  it('gắn class badge theo state', () => {
    const { container } = render(<Status value="da_dong" />);
    const badge = container.querySelector('.badge');
    expect(badge).not.toBeNull();
    expect(badge.className).toContain('da_dong');
  });

  it('render giá trị thô khi state không có nhãn', () => {
    render(<Status value="unknown_state_xyz" />);
    expect(screen.getByText('unknown_state_xyz')).toBeInTheDocument();
  });
});

describe('Stat', () => {
  it('render label và value', () => {
    render(<Stat label="Tổng hồ sơ" value={42} />);
    expect(screen.getByText('Tổng hồ sơ')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
