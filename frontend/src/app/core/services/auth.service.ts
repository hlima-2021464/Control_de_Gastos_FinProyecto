import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';
import {
  AuthSuccessResponse,
  LoginRequest,
  UserProfile,
} from '../models/auth.models';

const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'auth_user';

/** Decodifica el payload de un JWT sin verificar la firma (solo lectura). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url -> base64 -> JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json   = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // ─── Signals reactivos ──────────────────────────────────────
  /** Perfil del usuario autenticado actual */
  readonly currentUser = signal<UserProfile | null>(this.loadUser());

  /** Controla la visibilidad del modal de sesión expirada */
  readonly sessionExpired = signal<boolean>(false);

  /** Marca de tiempo de la última emisión o renovación de token */
  readonly ultimoTokenRenovado = signal<string>(
    new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  /** Identifica la modalidad de autenticación activa */
  get tipoAutenticacion(): string {
    const token = this.getToken();
    const user = this.currentUser();
    if (!token || !user) {
      return 'Sesión Inactiva';
    }
    if (token.includes('google_session_signature') || token.includes('google_mock_signature')) {
      return 'Google OAuth 2.0 GIS (Sesión Sintética)';
    }
    if (user.picture && (user.picture.includes('googleusercontent.com') || user.picture.includes('ui-avatars.com'))) {
      return 'Google Identity Services (GIS OAuth 2.0)';
    }
    return 'Autenticación Local (JWT Estándar)';
  }

  constructor(private readonly http: HttpClient) {}


  // ─── Login Estándar ─────────────────────────────────────────
  login(credentials: LoginRequest): Observable<AuthSuccessResponse> {
    return this.http
      .post<AuthSuccessResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap((response) => {
          this.saveSession(response.data.token, response.data.user);
        }),
        catchError(this.handleError)
      );
  }

  // ─── Google OAuth Login Real (Credencial JWT oficial de GIS) ──
  loginWithGoogleCredential(credential: string): UserProfile {
    const payload = decodeJwtPayload(credential) || {};
    const email = (payload['email'] as string) || 'usuario@gmail.com';
    const name =
      (payload['name'] as string) ||
      (payload['given_name'] as string) ||
      email.split('@')[0];
    const picture =
      (payload['picture'] as string) ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8b5cf6&color=fff&bold=true`;
    const sub = (payload['sub'] as string) || String(Date.now());

    const user: UserProfile = {
      id: sub,
      username: name,
      name: name,
      email: email,
      picture: picture,
      avatarUrl: picture,
      role: 'USER',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.saveSession(credential, user);
    return user;
  }

  // ─── Google Direct Login (Sin requerir contraseña de Google) ─
  loginWithGoogleProfile(profile: {
    name: string;
    email: string;
    picture?: string;
  }): UserProfile {
    const cleanName = profile.name.trim() || profile.email.split('@')[0] || 'Usuario';
    const cleanEmail = profile.email.trim() || 'usuario@gmail.com';
    const cleanPicture =
      profile.picture?.trim() ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=8b5cf6&color=fff&bold=true`;

    const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadData = {
      sub: `google-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      picture: cleanPicture,
      exp,
    };
    const payloadStr = btoa(JSON.stringify(payloadData));
    const syntheticToken = `${header}.${payloadStr}.google_session_signature`;

    const user: UserProfile = {
      id: `google-${Date.now()}`,
      username: cleanName,
      name: cleanName,
      email: cleanEmail,
      picture: cleanPicture,
      avatarUrl: cleanPicture,
      role: 'USER',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.saveSession(syntheticToken, user);
    return user;
  }

  // ─── Renovación de Token por Actividad (Throttled) ───────────
  refreshTokenOnActivity(): void {
    const token = this.getToken();
    if (!token || !this.currentUser()) return;

    // Si es un token sintético de sesión Google, renovar su exp local
    if (token.includes('google_session_signature') || token.includes('google_mock_signature')) {
      const payload = decodeJwtPayload(token);
      if (payload) {
        payload['exp'] = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payloadStr = btoa(JSON.stringify(payload));
        const updatedToken = `${header}.${payloadStr}.google_session_signature`;
        localStorage.setItem(TOKEN_KEY, updatedToken);
        this.ultimoTokenRenovado.set(
          new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      }
      return;
    }

    // Si es un token del backend, solicitar refresh al endpoint protegido
    this.http
      .post<AuthSuccessResponse>(`${this.apiUrl}/refresh`, {})
      .pipe(
        tap((response) => {
          if (response?.data?.token) {
            localStorage.setItem(TOKEN_KEY, response.data.token);
            this.ultimoTokenRenovado.set(
              new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            );
          }
        }),
        catchError(() => of(null))
      )
      .subscribe();
  }

  // ─── Logout ─────────────────────────────────────────────────
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
  }

  // ─── Sesión Expirada por Inactividad ────────────────────────
  triggerSessionExpired(): void {
    if (this.sessionExpired()) return;
    this.logout();
    this.sessionExpired.set(true);
  }

  clearSessionExpired(): void {
    this.sessionExpired.set(false);
  }

  // ─── Helpers ────────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken() && !!this.currentUser();
  }

  // ─── Privados ───────────────────────────────────────────────
  private saveSession(token: string, user: UserProfile): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
    this.sessionExpired.set(false);
    this.ultimoTokenRenovado.set(
      new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  }


  private loadUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'Ocurrio un error inesperado.';

    if (error.status === 0) {
      message = 'No se pudo conectar con el servidor. Verifique su conexion.';
    } else if (error.status === 401) {
      message =
        'Credenciales invalidas. Verifique su usuario o correo y contrasena.';
    } else if (error.status === 400) {
      message = error.error?.message ?? 'Datos de entrada invalidos.';
    } else if (error.status >= 500) {
      message = 'Error interno del servidor. Intente de nuevo mas tarde.';
    }

    return throwError(() => new Error(message));
  }
}
