import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import * as categoryApi from '@/lib/api/useful-map-categories';
import UsefulMapCategoriesAdminPanel from '@/components/UsefulMapCategoriesAdminPanel';
import type { UsefulMapCategoryAdmin } from '@/types/useful-maps';

jest.mock('@/lib/api/useful-map-categories');

describe('UsefulMapCategoriesAdminPanel', () => {
  const mockCategories: UsefulMapCategoryAdmin[] = [
    {
      id: 'cat-1',
      slug: 'general',
      label: 'General',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      mapCount: 3,
    },
    {
      id: 'cat-2',
      slug: 'license-plates',
      label: 'License Plates',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      mapCount: 5,
    },
  ];

  const mockOnChanged = jest.fn();

  it('renders rows for supplied categories including mapCount', () => {
    render(<UsefulMapCategoriesAdminPanel categories={mockCategories} onChanged={mockOnChanged} />);

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('License Plates')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('typing a label auto-fills the slug, and manual slug edit survives further label typing', async () => {
    const user = userEvent.setup();
    render(<UsefulMapCategoriesAdminPanel categories={mockCategories} onChanged={mockOnChanged} />);

    const labelInput = screen.getByPlaceholderText('Category label');
    const slugInput = screen.getByPlaceholderText('Slug (auto-derived)');

    await user.type(labelInput, 'Test Category');
    expect(slugInput).toHaveValue('test-category');

    await user.clear(slugInput);
    await user.type(slugInput, 'custom-slug');
    expect(slugInput).toHaveValue('custom-slug');

    await user.clear(labelInput);
    await user.type(labelInput, 'Another Label');
    expect(slugInput).toHaveValue('custom-slug');
  });

  it('submitting calls createUsefulMapCategory and onChanged', async () => {
    const user = userEvent.setup();
    const mockCreate = jest.fn().mockResolvedValue({
      id: 'cat-new',
      slug: 'new-cat',
      label: 'New Cat',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
      mapCount: 0,
    });
    (jest.mocked(categoryApi).createUsefulMapCategory as jest.Mock) = mockCreate;

    render(<UsefulMapCategoriesAdminPanel categories={mockCategories} onChanged={mockOnChanged} />);

    const labelInput = screen.getByPlaceholderText('Category label');
    const submitButton = screen.getByRole('button', { name: /create category/i });

    await user.type(labelInput, '  Trimmed Label  ');
    await user.click(submitButton);

    expect(mockCreate).toHaveBeenCalledWith({
      label: 'Trimmed Label',
      slug: 'trimmed-label',
    });
    expect(mockOnChanged).toHaveBeenCalled();
  });

  it('Delete is disabled for a category with mapCount > 0', () => {
    render(<UsefulMapCategoriesAdminPanel categories={mockCategories} onChanged={mockOnChanged} />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons[0]).toBeDisabled();
  });

  it('empty state renders when categories is empty', () => {
    render(<UsefulMapCategoriesAdminPanel categories={[]} onChanged={mockOnChanged} />);

    expect(screen.getByText(/no categories yet/i)).toBeInTheDocument();
  });
});
