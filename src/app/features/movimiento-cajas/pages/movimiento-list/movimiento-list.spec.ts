import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovimientoList } from './movimiento-list';

describe('MovimientoList', () => {
  let component: MovimientoList;
  let fixture: ComponentFixture<MovimientoList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovimientoList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovimientoList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
