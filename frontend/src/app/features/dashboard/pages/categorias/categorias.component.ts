import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { CategoryService, CategoryItem } from '../../../../core/services/category.service';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './categorias.component.html',
  styleUrls: ['./categorias.component.css'],
})
export class CategoriasComponent {
  private readonly categorySvc = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  readonly tabActiva = signal<'GASTO' | 'INGRESO'>('GASTO');
  readonly categoriasGasto$: Observable<CategoryItem[]> = this.categorySvc.categoriasGasto$;
  readonly categoriasIngreso$: Observable<CategoryItem[]> = this.categorySvc.categoriasIngreso$;

  // ─── Modal de Categoría ──────────────────────────────────────
  readonly mostrarModal = signal<boolean>(false);
  readonly modoEdicion = signal<boolean>(false);
  readonly categoriaEditandoId = signal<string | null>(null);
  readonly mensajeAlerta = signal<string | null>(null);

  readonly paletaColores: string[] = [
    '#f97316', // Naranja
    '#06b6d4', // Cian
    '#ec4899', // Rosa
    '#8b5cf6', // Violeta
    '#f59e0b', // Ámbar
    '#10b981', // Esmeralda
    '#3b82f6', // Azul
    '#14b8a6', // Verde azulado
    '#e11d48', // Carmesí
    '#6366f1', // Índigo
  ];

  readonly iconosDisponibles = [
    { id: 'utensils', label: 'Alimentos' },
    { id: 'car', label: 'Transporte' },
    { id: 'heart', label: 'Salud' },
    { id: 'academic', label: 'Educación' },
    { id: 'film', label: 'Ocio' },
    { id: 'lightning', label: 'Servicios' },
    { id: 'briefcase', label: 'Trabajo' },
    { id: 'laptop', label: 'Tecnología' },
    { id: 'chart', label: 'Finanzas' },
  ];

  readonly categoriaForm: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    tipo: ['GASTO', [Validators.required]],
    colorHex: ['#8b5cf6', [Validators.required]],
    icono: ['chart', [Validators.required]],
  });

  setTab(tab: 'GASTO' | 'INGRESO'): void {
    this.tabActiva.set(tab);
  }

  abrirModalRegistro(): void {
    this.modoEdicion.set(false);
    this.categoriaEditandoId.set(null);
    this.categoriaForm.reset({
      nombre: '',
      tipo: this.tabActiva(),
      colorHex: '#8b5cf6',
      icono: 'chart',
    });
    this.mensajeAlerta.set(null);
    this.mostrarModal.set(true);
  }

  abrirModalEditar(item: CategoryItem): void {
    this.modoEdicion.set(true);
    this.categoriaEditandoId.set(item.id);
    this.categoriaForm.patchValue({
      nombre: item.nombre,
      tipo: item.tipo,
      colorHex: item.colorHex,
      icono: item.icono,
    });
    this.mensajeAlerta.set(null);
    this.mostrarModal.set(true);
  }

  eliminarCategoria(item: CategoryItem): void {
    this.mensajeAlerta.set(null);
    const resultado = this.categorySvc.eliminarCategoria(item.id);
    if (!resultado.exitoso) {
      alert(resultado.motivo || 'No se puede eliminar la categoría.');
    }
  }

  restablecerCategorias(): void {
    if (confirm('¿Desea restaurar el listado de categorías predeterminado del sistema?')) {
      this.categorySvc.restablecerCategorias();
    }
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
    this.modoEdicion.set(false);
    this.categoriaEditandoId.set(null);
    this.categoriaForm.reset();
  }

  guardarCategoria(): void {
    if (this.categoriaForm.invalid) {
      this.categoriaForm.markAllAsTouched();
      return;
    }

    const formVal = this.categoriaForm.value;

    if (this.modoEdicion() && this.categoriaEditandoId()) {
      this.categorySvc.actualizarCategoria(this.categoriaEditandoId()!, {
        nombre: formVal.nombre,
        colorHex: formVal.colorHex,
        icono: formVal.icono,
      });
    } else {
      this.categorySvc.agregarCategoria({
        nombre: formVal.nombre,
        tipo: formVal.tipo,
        colorHex: formVal.colorHex,
        icono: formVal.icono,
      });
    }

    this.cerrarModal();
  }
}
