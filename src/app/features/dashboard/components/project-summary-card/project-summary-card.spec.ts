import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectSummaryCard } from './project-summary-card';

describe('ProjectSummaryCard', () => {
  let component: ProjectSummaryCard;
  let fixture: ComponentFixture<ProjectSummaryCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectSummaryCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectSummaryCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
