import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService } from '../../../core/services/settings.service';

interface NavItem {
  id: string;
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './dashboard-layout.component.html',
  styleUrls: ['./dashboard-layout.component.css'],
})
export class DashboardLayoutComponent {
  private readonly authSvc = inject(AuthService);
  private readonly settingsSvc = inject(SettingsService);
  private readonly router = inject(Router);

  readonly currentUser = this.authSvc.currentUser;
  readonly settings = toSignal(this.settingsSvc.settings$, { initialValue: this.settingsSvc.snapshot });
  readonly logoError = signal(false);

  readonly navItems: NavItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      route: '/dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    },
    {
      id: 'nav-gastos',
      label: 'Gastos',
      route: '/dashboard/gastos',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    },
    {
      id: 'nav-ingresos',
      label: 'Ingresos',
      route: '/dashboard/ingresos',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      id: 'nav-presupuestos',
      label: 'Presupuestos',
      route: '/dashboard/presupuestos',
      icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    },
    {
      id: 'nav-categorias',
      label: 'Categorías',
      route: '/dashboard/categorias',
      icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    },
    {
      id: 'nav-reportes',
      label: 'Reportes',
      route: '/dashboard/reportes',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
    {
      id: 'nav-ahorro',
      label: 'Ahorro',
      route: '/dashboard/ahorro',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    },
    {
      id: 'nav-configuracion',
      label: 'Configuración',
      route: '/dashboard/configuracion',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    },
  ];

  onLogoError(): void {
    this.logoError.set(true);
  }

  logout(): void {
    this.authSvc.logout();
    this.router.navigate(['/login']);
  }

  get userDisplayName(): string {
    const custom = this.settings()?.perfilVisual?.nombreVisualizacion?.trim();
    if (custom) return custom;
    const user = this.currentUser();
    return user?.name || user?.username || user?.email || 'Usuario';
  }

  get userAvatarUrl(): string | null {
    const perfil = this.settings()?.perfilVisual;
    if (perfil?.tipoAvatar === 'iniciales') {
      return null;
    }
    const user = this.currentUser();
    return user?.picture || user?.avatarUrl || null;
  }

  get avatarGradientClass(): string {
    return this.settings()?.perfilVisual?.fondoGradiente || 'from-violet-600 to-cyan-400';
  }

  get userInitial(): string {
    const name = this.userDisplayName;
    return (name && name.length > 0) ? name.charAt(0).toUpperCase() : 'U';
  }
}

