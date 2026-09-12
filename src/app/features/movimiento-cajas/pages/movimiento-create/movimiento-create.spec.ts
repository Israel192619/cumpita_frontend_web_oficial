import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';

import { MovimientoCreate } from './movimiento-create';
import { MovimientoService } from '../../services/movimiento-service';

describe('MovimientoCreate', () => {
  let component: MovimientoCreate;
  let fixture: ComponentFixture<MovimientoCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientoCreate],
      providers: [
        {
          provide: MovimientoService,
          useValue: { crear: () => of({}) },
        },
        {
          provide: Router,
          useValue: { navigate: () => Promise.resolve(true) },
        },
        {
          provide: ToastrService,
          useValue: { success: () => undefined, error: () => undefined },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientoCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
