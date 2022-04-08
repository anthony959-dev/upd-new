import { Component, OnInit } from '@angular/core';
import { ProjectsDetailsFacade } from '../+state/projects-details.facade';

@Component({
  selector: 'app-project-details-summary',
  templateUrl: './project-details-summary.component.html',
  styleUrls: ['./project-details-summary.component.css'],
})
export class ProjectDetailsSummaryComponent {

  data$ = this.projectsDetailsService.projectsDetailsData$;
  
  constructor(private readonly projectsDetailsService: ProjectsDetailsFacade) {}
}
