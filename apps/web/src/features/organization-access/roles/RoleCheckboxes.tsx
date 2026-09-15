import { useTranslation } from 'react-i18next';
import { SYSTEM_ROLES, type SystemRole } from '@planix/core/features/organization-access/roles.ts';

interface RoleCheckboxesProps {
  readonly legend: string;
  readonly value: ReadonlySet<SystemRole>;
  readonly onChange: (roles: ReadonlySet<SystemRole>) => void;
}

/** Multi-select of system roles (FR-012: a membership holds several roles; permissions are their union). */
export function RoleCheckboxes({ legend, value, onChange }: RoleCheckboxesProps) {
  const { t } = useTranslation();
  const toggle = (role: SystemRole, checked: boolean) => {
    const next = new Set(value);
    if (checked) next.add(role);
    else next.delete(role);
    onChange(next);
  };
  return (
    <fieldset className="role-picker">
      <legend>{legend}</legend>
      {SYSTEM_ROLES.map((role) => (
        <label key={role} className="role-option">
          <input type="checkbox" checked={value.has(role)} onChange={(e) => toggle(role, e.target.checked)} />
          {t(`roles.${role}`)}
        </label>
      ))}
    </fieldset>
  );
}

/** Roles in canonical order, translated and joined for display. */
export function useRoleList() {
  const { t } = useTranslation();
  return (roles: readonly string[]) =>
    SYSTEM_ROLES.filter((role) => roles.includes(role))
      .map((role) => t(`roles.${role}`))
      .join(', ');
}
