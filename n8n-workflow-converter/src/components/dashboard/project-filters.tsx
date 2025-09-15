'use client';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Filter, X } from 'lucide-react';
import { Database } from '@/types/database';

type ProjectStatus = Database['public']['Tables']['projects']['Row']['status'];

interface ProjectFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: ProjectStatus | 'all';
  onStatusFilterChange: (status: ProjectStatus | 'all') => void;
  sortBy: 'created_at' | 'updated_at' | 'name';
  onSortByChange: (sortBy: 'created_at' | 'updated_at' | 'name') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function ProjectFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onClearFilters,
  hasActiveFilters
}: ProjectFiltersProps) {
  return (
    <div className="bg-white p-4 rounded-lg border space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <Select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as ProjectStatus | 'all')}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </Select>
        </div>

        {/* Sort By */}
        <Select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as 'created_at' | 'updated_at' | 'name')}
        >
          <option value="created_at">Created Date</option>
          <option value="updated_at">Updated Date</option>
          <option value="name">Name</option>
        </Select>

        {/* Sort Order */}
        <Select
          value={sortOrder}
          onChange={(e) => onSortOrderChange(e.target.value as 'asc' | 'desc')}
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}