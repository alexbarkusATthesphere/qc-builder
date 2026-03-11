import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WaterfallChart } from './waterfall-chart';

describe('WaterfallChart', () => {
  let component: WaterfallChart;
  let fixture: ComponentFixture<WaterfallChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WaterfallChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WaterfallChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
