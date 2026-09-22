'use client';

/**
 * Menu categories — `MenuManagement/Category/{Index,Create,Edit}`.
 *
 * The API has been complete and only ever read from: the Menu screen lists
 * categories and nothing could add, rename or remove one.
 *
 * THREE FIELDS, THREE DIFFERENT ABSENT-KEY RULES, all from the source and all
 * pinned in `resolveCategoryUpdate`:
 *
 *     parentId:  input.parent_id ?? null              — absent CLEARS the parent
 *     imagePath: input.image_path ?? existing.image   — absent KEEPS the image
 *     isActive:  input.is_active ?? existing.isActive — absent KEEPS the flag
 *
 * The form is built so none of the three can surprise anyone. `parent_id` is a
 * real select whose empty option means null, which is the same thing the source
 * means by clearing it. `is_active` is a checkbox that is always sent, so the
 * "keeps existing" branch is never taken. And `image_path` is deliberately NOT
 * a field — there is no upload here yet, and because the rule coalesces on
 * nullish, leaving it out preserves whatever image the category already has.
 *
 * Deleting a parent does not delete its children. There is no dependency guard
 * — unlike branches, which refuse while sixteen tables still hold rows — and
 * the FK is `nullOnDelete`, so the children are promoted to top level.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListTree } from 'lucide-react';
import { ResourcePage } from '../ui/resource-page';
import type { DataTableColumn } from '../ui/kit';
import { Status } from '../ui/kit';
import { menu } from '../restaurant-client';
import type { RstCategoryRow } from '../restaurant-client';

export function RestaurantCategories() {
  // The parent select offers every category, ordered by name, exactly as
  // `MenuCategoryController` does. `omitSelfOption` drops the row being edited
  // — the source's `whereKeyNot($category->id)`.
  const { data: all = [] } = useQuery({
    queryKey: ['rst', 'categories'],
    queryFn: () => menu.categories(),
  });

  const nameById = new Map(all.map((c) => [c.id, c.name]));

  const columns: DataTableColumn<RstCategoryRow>[] = [
    { key: 'name', header: 'Category', sortable: true, render: (c) => c.name },
    {
      key: 'parent', header: 'Parent', width: 200,
      render: (c) => (c.parent_id ? nameById.get(c.parent_id) ?? c.parent_id : '—'),
    },
    {
      key: 'active', header: 'Status', width: 120,
      render: (c) => <Status tone={c.is_active ? 'active' : 'neutral'}>{c.is_active ? 'Active' : 'Inactive'}</Status>,
    },
  ];

  return (
    <ResourcePage<RstCategoryRow>
      title="Menu categories"
      singular="Category"
      subtitle="How the menu is grouped."
      icon={ListTree}
      queryKey={['rst', 'categories']}
      load={() => menu.categories()}
      search={{ match: (c, q) => (c.name ?? '').toLowerCase().includes(q) }}
      columns={columns}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'parent_id', label: 'Parent category', type: 'select',
          options: [...all]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => ({ label: c.name, value: c.id })),
          hint: 'Leave empty for a top-level category. The source excludes only the category itself from this list, so a category can still be made a child of its own child.',
        },
        { name: 'is_active', label: 'Active', type: 'checkbox',
          hint: 'Defaults to active on create. Always sent on edit, so it never falls through to the stored value.' },
        // `image_path` is deliberately absent — see the note at the top of the
        // file. Omitting it is what preserves the existing image.
      ]}
      omitSelfOption={['parent_id']}
      toForm={(c) => ({
        name: c.name,
        parent_id: c.parent_id ?? '',
        is_active: c.is_active !== false,
      })}
      create={(body) => menu.createCategory(body as Partial<RstCategoryRow>)}
      update={(id, body) => menu.updateCategory(id, body as Partial<RstCategoryRow>)}
      remove={(id) => menu.removeCategory(id)}
    >
      <p className="ds-caption rst-footnote">
        Deleting a category does not delete the items or the sub-categories under it. There is no
        dependency guard here — children are promoted to top level and items keep their other
        categories.
      </p>
    </ResourcePage>
  );
}
