import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GnattChart } from './gnatt-chart';

describe('GnattChart', () => {
  let component: GnattChart;
  let fixture: ComponentFixture<GnattChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GnattChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GnattChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
