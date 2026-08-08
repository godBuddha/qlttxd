import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Timeline } from './CaseDetail.jsx';

describe('Timeline — state history rendering', () => {
  it('renders case creation entry with date', () => {
    const item = {
      id: '123',
      ma_ho_so: 'HS-001',
      trang_thai: 'cho_tiep_nhan',
      created_at: '2026-07-01T08:00:00Z',
      updated_at: '2026-07-01T08:00:00Z',
    };
    render(<Timeline item={item} history={[]} />);
    expect(screen.getByText('Khởi tạo hồ sơ')).toBeInTheDocument();
    expect(screen.queryByText(/Không thể kết nối máy chủ/i)).not.toBeInTheDocument();
  });

  it('renders status change entries from history', () => {
    const item = {
      id: '123',
      ma_ho_so: 'HS-001',
      trang_thai: 'da_lap_bien_ban',
      created_at: '2026-07-01T08:00:00Z',
      updated_at: '2026-07-03T10:00:00Z',
    };
    const history = [
      {
        thoi_gian: '2026-07-01T10:00:00Z',
        full_name: 'Nguyễn A',
        chi_tiet: JSON.stringify({ from: 'cho_tiep_nhan', to: 'cho_xac_minh' }),
      },
      {
        thoi_gian: '2026-07-02T14:00:00Z',
        full_name: 'Trần B',
        chi_tiet: JSON.stringify({ from: 'cho_xac_minh', to: 'cho_lap_bien_ban' }),
      },
      {
        thoi_gian: '2026-07-03T10:00:00Z',
        full_name: null,
        username: 'user_c',
        chi_tiet: JSON.stringify({ from: 'cho_lap_bien_ban', to: 'da_lap_bien_ban' }),
      },
    ];
    render(<Timeline item={item} history={history} />);

    // Should show all status transitions
    expect(screen.getByText(/Chờ tiếp nhận → Chờ xác minh/i)).toBeInTheDocument();
    expect(screen.getByText(/Chờ xác minh → Chờ lập biên bản/i)).toBeInTheDocument();
    expect(screen.getByText(/Đã lập biên bản/i)).toBeInTheDocument();
    // User names should appear
    expect(screen.getByText('Nguyễn A')).toBeInTheDocument();
    expect(screen.getByText('Trần B')).toBeInTheDocument();
    expect(screen.getByText('user_c')).toBeInTheDocument();
  });

  it('marks current state as current in timeline', () => {
    const item = {
      id: '123',
      ma_ho_so: 'HS-001',
      trang_thai: 'dang_xac_minh',
      created_at: '2026-07-01T08:00:00Z',
      updated_at: '2026-07-01T12:00:00Z',
    };
    const history = [
      {
        thoi_gian: '2026-07-01T10:00:00Z',
        full_name: 'Admin',
        chi_tiet: JSON.stringify({ from: 'cho_tiep_nhan', to: 'dang_xac_minh' }),
      },
    ];
    const { container } = render(<Timeline item={item} history={history} />);
    const timelineItems = container.querySelectorAll('.timeline li');
    // The last entry (dang_xac_minh) should have class "current"
    expect(timelineItems[timelineItems.length - 1]).toHaveClass('current');
  });

  it('marks terminal states (da_dong, da_huy, da_chuyen_co_quan) with terminal class', () => {
    const item = {
      id: '123',
      ma_ho_so: 'HS-001',
      trang_thai: 'da_dong',
      created_at: '2026-07-01T08:00:00Z',
      updated_at: '2026-07-05T10:00:00Z',
    };
    const history = [
      {
        thoi_gian: '2026-07-05T10:00:00Z',
        full_name: null,
        username: null,
        chi_tiet: JSON.stringify({ from: 'da_khac_phuc', to: 'da_dong' }),
      },
    ];
    const { container } = render(<Timeline item={item} history={history} />);
    const timelineItems = container.querySelectorAll('.timeline li');
    expect(timelineItems[timelineItems.length - 1]).toHaveClass('terminal');
  });

  it('shows placeholder when no entries', () => {
    const item = {
      id: '123',
      ma_ho_so: 'HS-001',
      trang_thai: 'cho_tiep_nhan',
      created_at: null,
      updated_at: null,
    };
    render(<Timeline item={item} history={[]} />);
    expect(screen.getByText('Chưa có dữ liệu tiến trình.')).toBeInTheDocument();
  });

  it('includes user field when detail.to matches current state, no duplicate', () => {
    const item = {
      id: '123',
      ma_ho_so: 'HS-001',
      trang_thai: 'da_huy',
      created_at: '2026-07-01T08:00:00Z',
      updated_at: '2026-07-02T09:00:00Z',
    };
    const history = [
      {
        thoi_gian: '2026-07-02T09:00:00Z',
        full_name: 'Leader X',
        chi_tiet: JSON.stringify({ from: 'cho_xac_minh', to: 'da_huy' }),
      },
    ];
    const { container } = render(<Timeline item={item} history={history} />);
    // Should not duplicate "Đã hủy" because history already covers it
    const items = container.querySelectorAll('.timeline li');
    const labels = Array.from(items).map((li) => li.querySelector('b')?.textContent || '');
    const huyCount = labels.filter((l) => l.includes('Đã hủy')).length;
    expect(huyCount).toBe(1);
  });

  it('uses STATE_LABELS for Vietnamese display', () => {
    const item = {
      id: '123',
      ma_ho_so: 'HS-001',
      trang_thai: 'cho_bo_sung',
      created_at: '2026-07-01T08:00:00Z',
      updated_at: '2026-07-01T10:00:00Z',
    };
    const history = [
      {
        thoi_gian: '2026-07-01T10:00:00Z',
        full_name: null,
        chi_tiet: JSON.stringify({ from: 'dang_xac_minh', to: 'cho_bo_sung' }),
      },
    ];
    render(<Timeline item={item} history={history} />);
    expect(screen.getByText(/Chờ bổ sung/i)).toBeInTheDocument();
  });
});
