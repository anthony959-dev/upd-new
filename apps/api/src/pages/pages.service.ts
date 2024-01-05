import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Cache } from 'cache-manager';
import { Model, Types } from 'mongoose';
import type {
  FeedbackModel,
  MetricsConfig,
  PageDocument,
  PageMetricsModel,
  ProjectDocument,
  TaskDocument,
  UrlModel,
} from '@dua-upd/db';
import {
  DbService,
  Feedback,
  Page,
  PageMetrics,
  Project,
  Readability,
  Task,
  Url,
} from '@dua-upd/db';
import type {
  ApiParams,
  GscSearchTermMetrics,
  PageAggregatedData,
  PageDetailsData,
  PagesHomeData,
  PagesHomeAggregatedData,
  ActivityMapMetrics,
  PageStatus,
} from '@dua-upd/types-common';
import {
  arrayToDictionary,
  dateRangeSplit,
} from '@dua-upd/utils-common';
import { InternalSearchTerm } from '@dua-upd/types-common';

@Injectable()
export class PagesService {
  constructor(
    private db: DbService,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetricsModel: PageMetricsModel,
    @InjectModel(Feedback.name, 'defaultConnection')
    private feedbackModel: FeedbackModel,
    @InjectModel(Page.name, 'defaultConnection')
    private pageModel: Model<PageDocument>,
    @InjectModel(Task.name, 'defaultConnection')
    private taskModel: Model<TaskDocument>,
    @InjectModel(Project.name, 'defaultConnection')
    private projectModel: Model<ProjectDocument>,
    @InjectModel(Readability.name, 'defaultConnection')
    private readabilityModel: Model<Readability>,
    @InjectModel(Url.name, 'defaultConnection')
    private urls: UrlModel,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async listPages({ projection, populate }): Promise<Page[]> {
    let query = this.pageModel.find({}, projection);
    if (populate) {
      const populateArray = populate.split(',').map(item => item.trim());
      query = query.populate(populateArray);
    }

    return await query.exec();
  }

  async getPagesHomeData(dateRange: string): Promise<PagesHomeData> {
    const cacheKey = `getPagesHomeData-${dateRange}`;
    const cachedData = (await this.cacheManager.store.get(
      cacheKey,
    )) as PagesHomeAggregatedData[];

    if (cachedData) {
      return {
        dateRange,
        dateRangeData: cachedData,
      };
    }

    const [startDate, endDate] = dateRangeSplit(dateRange);
    const queryDateRange = {
      start: startDate,
      end: endDate,
    };

    const results = await this.db.views.pageVisits.getVisitsWithPageData(
      queryDateRange,
      this.pageModel
    );

    await this.cacheManager.set(cacheKey, results);

    return {
      dateRange,
      dateRangeData: results,
    };
  }

  async getPageDetails(params: ApiParams): Promise<PageDetailsData> {
    if (!params.id) {
      throw Error(
        'Attempted to get Page details from API but no id was provided.',
      );
    }
    const cacheKey = `getPageDetails-${params.id}-${params.dateRange}-${params.comparisonDateRange}`;
    const cachedData =
      await this.cacheManager.store.get<PageDetailsData>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const page = await this.pageModel
      .findById(new Types.ObjectId(params.id), {
        title: 1,
        url: 1,
        tasks: 1,
        projects: 1,
      })
      .populate('tasks')
      .populate('projects')
      .lean();

    const urls = (
      await this.urls
        .aggregate()
        .match({ page: new Types.ObjectId(params.id) })
        .project({ _id: 0, is_404: 1, redirect: 1 })
        .exec()
    )[0];

    const projects = (page.projects || [])
      .map((project) => {
        return { id: project._id, title: project.title };
      })
      .flat();

    const queryMetricsConfig = [
      'visits',
      'visitors',
      'views',
      'visits_device_other',
      'visits_device_desktop',
      'visits_device_mobile',
      'visits_device_tablet',
      { $avg: 'average_time_spent' },
      'gsc_total_clicks',
      'gsc_total_impressions',
      { $avg: 'gsc_total_ctr' },
      { $avg: 'gsc_total_position' },
      'dyf_no',
      'dyf_yes',
      'dyf_submit',
      'fwylf_cant_find_info',
      'fwylf_error',
      'fwylf_hard_to_understand',
      'fwylf_other',
      'visits_geo_ab',
      'visits_geo_bc',
      'visits_geo_mb',
      'visits_geo_nb',
      'visits_geo_nl',
      'visits_geo_ns',
      'visits_geo_nt',
      'visits_geo_nu',
      'visits_geo_on',
      'visits_geo_pe',
      'visits_geo_qc',
      'visits_geo_sk',
      'visits_geo_us',
      'visits_geo_yt',
      'visits_geo_outside_canada',
      'visits_referrer_other',
      'visits_referrer_searchengine',
      'visits_referrer_social',
      'visits_referrer_typed_bookmarked',
    ] as (keyof PageAggregatedData | MetricsConfig<PageAggregatedData>)[];

    const dateRangeData: PageAggregatedData = (
      await this.pageMetricsModel.getAggregatedPageMetrics(
        params.dateRange,
        queryMetricsConfig,
        { page: page._id },
      )
    )[0];

    const dateRangeDataByDay = await this.getPageDetailsDataByDay(
      page,
      params.dateRange,
    );

    const comparisonDateRangeData = (
      await this.pageMetricsModel.getAggregatedPageMetrics(
        params.comparisonDateRange,
        queryMetricsConfig,
        { page: page._id },
      )
    )[0];

    const comparisonDateRangeDataByDay = await this.getPageDetailsDataByDay(
      page,
      params.comparisonDateRange,
    );

    const aggregatedSearchTermMetrics =
      aggregateSearchTermMetrics(dateRangeDataByDay);
    const aggregatedComparisonSearchTermMetrics = aggregateSearchTermMetrics(
      comparisonDateRangeDataByDay,
    );

    const searchTermsWithPercentChange = getSearchTermsWithPercentChange(
      aggregatedSearchTermMetrics,
      aggregatedComparisonSearchTermMetrics,
    );

    const topIncreasedSearchTerms = getTop5IncreaseSearchTerms(
      searchTermsWithPercentChange,
    );

    const top25GSCSearchTerms = getTop25SearchTerms(
      searchTermsWithPercentChange,
    );

    const topDecreasedSearchTerms = getTop5DecreaseSearchTerms(
      searchTermsWithPercentChange,
    );

    const readability = await this.readabilityModel
      .find({ page: new Types.ObjectId(params.id) })
      .sort({ date: -1 })
      .exec();

    const results = {
      ...page,
      is404: urls.is_404,
      isRedirect: !!urls.redirect,
      redirectUrl: urls.redirect || null,
      projects,
      dateRange: params.dateRange,
      dateRangeData: {
        ...dateRangeData,
        visitsByDay: dateRangeDataByDay.map((data) => ({
          date: data.date.toISOString(),
          visits: data.visits,
        })),
        feedbackByTags: await this.feedbackModel.getCommentsByTag(
          params.dateRange,
          [page.url],
        ),
        dyfByDay: await this.getDyfByDay(params.dateRange, params.id),
      },
      comparisonDateRange: params.comparisonDateRange,
      comparisonDateRangeData: {
        ...comparisonDateRangeData,
        visitsByDay: comparisonDateRangeDataByDay.map((data) => ({
          date: data.date.toISOString(),
          visits: data.visits,
        })),
        feedbackByTags: await this.feedbackModel.getCommentsByTag(
          params.comparisonDateRange,
          [page.url],
        ),
        dyfByDay: await this.getDyfByDay(params.comparisonDateRange, params.id),
      },
      topSearchTermsIncrease: topIncreasedSearchTerms,
      topSearchTermsDecrease: topDecreasedSearchTerms,
      top25GSCSearchTerms: top25GSCSearchTerms,
      feedbackComments: await this.feedbackModel.getComments(params.dateRange, [
        page.url,
      ]),
      searchTerms: await this.getTopSearchTerms(params),
      activityMap: await this.getActivityMapData(params),
      readability,
    } as PageDetailsData;

    await this.cacheManager.set(cacheKey, results);

    return results;
  }
  async getDyfByDay(dateRange: string, id: string) {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));
    return await this.pageMetricsModel
      .aggregate()
      .match({
        date: { $gte: startDate, $lte: endDate },
        page: new Types.ObjectId(id),
      })
      .group({
        _id: '$date',
        dyf_yes: { $sum: '$dyf_yes' },
        dyf_no: { $sum: '$dyf_no' },
        dyf_submit: { $sum: '$dyf_submit' },
      })
      .project({
        _id: 0,
        date: '$_id',
        dyf_yes: 1,
        dyf_no: 1,
        dyf_submit: 1,
      })
      .sort({ date: 1 })
      .exec();
  }

  async getPageDetailsDataByDay(page: Page, dateRange: string) {
    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    return (
      await this.pageMetricsModel
        .aggregate<PageMetrics>([
          {
            $match: {
              page: page._id,
              date: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $project: {
              _id: 0,
              visits: 1,
              date: 1,
              gsc_searchterms: 1,
            },
          },
          {
            $group: {
              _id: '$date',
              date: {
                $first: '$date',
              },
              visits: {
                $sum: '$visits',
              },
              gsc_searchterms: {
                $push: '$gsc_searchterms',
              },
            },
          },
        ])
        .sort('date')
        .exec()
    ).map((result) => ({
      ...result,
      gsc_searchterms: result.gsc_searchterms.flat(),
    }));
  }

  async getActivityMapData({ dateRange, comparisonDateRange, id }: ApiParams) {
    const [startDate, endDate] = dateRangeSplit(dateRange);
    const [prevStartDate, prevEndDate] = dateRangeSplit(comparisonDateRange);

    const results =
      (await this.pageMetricsModel
        .aggregate<ActivityMapMetrics>()
        .project({ date: 1, activity_map: 1, page: 1 })
        .match({
          date: {
            $gte: startDate,
            $lte: endDate,
          },
          page: new Types.ObjectId(id),
        })
        .unwind('$activity_map')
        .group({
          _id: '$activity_map.link',
          clicks: {
            $sum: '$activity_map.clicks',
          },
        })
        .sort({ clicks: -1 })
        .project({
          _id: 0,
          link: '$_id',
          clicks: 1,
        })
        .exec()) || [];

    const prevResults =
      (await this.pageMetricsModel
        .aggregate<ActivityMapMetrics>()
        .project({ date: 1, activity_map: 1, page: 1 })
        .match({
          date: { $gte: prevStartDate, $lte: prevEndDate },
          page: new Types.ObjectId(id),
        })
        .unwind('$activity_map')
        .match({
          'activity_map.link': {
            $in: results.map(({ link }) => link),
          },
        })
        .group({
          _id: '$activity_map.link',
          clicks: {
            $sum: '$activity_map.clicks',
          },
        })
        .project({
          _id: 0,
          link: '$_id',
          clicks: 1,
        })
        .exec()) || [];

    const prevResultsDict = arrayToDictionary(prevResults, 'link');

    return results.map((result) => {
      const prevCount = prevResultsDict[result.link]?.clicks;
      const clicksChange =
        typeof prevCount === 'number' && prevCount !== 0
          ? Math.round(((result.clicks - prevCount) / prevCount) * 100) / 100
          : null;

      return {
        ...result,
        clicksChange,
      };
    });
  }

  async getTopSearchTerms({ dateRange, comparisonDateRange, id }: ApiParams) {
    const [startDate, endDate] = dateRangeSplit(dateRange);
    const [prevStartDate, prevEndDate] = dateRangeSplit(comparisonDateRange);

    const results =
      (await this.pageMetricsModel
        .aggregate<InternalSearchTerm>()
        .project({ date: 1, aa_searchterms: 1, page: 1 })
        .match({
          date: {
            $gte: startDate,
            $lte: endDate,
          },
          page: new Types.ObjectId(id),
        })
        .unwind('$aa_searchterms')
        .addFields({
          'aa_searchterms.term': {
            $toLower: '$aa_searchterms.term',
          },
        })
        .group({
          _id: '$aa_searchterms.term',
          clicks: {
            $sum: '$aa_searchterms.clicks',
          },
          position: {
            $avg: '$aa_searchterms.position',
          },
        })
        .sort({ clicks: -1 })
        .limit(10)
        .project({
          _id: 0,
          term: '$_id',
          clicks: 1,
          position: {
            $round: ['$position', 2],
          },
        })
        .exec()) || [];

    const prevResults =
      (await this.pageMetricsModel
        .aggregate<Pick<InternalSearchTerm, 'term' | 'clicks'>>()
        .project({ date: 1, aa_searchterms: 1, page: 1 })
        .match({
          date: { $gte: prevStartDate, $lte: prevEndDate },
          page: new Types.ObjectId(id),
        })
        .unwind('$aa_searchterms')
        .addFields({
          'aa_searchterms.term': {
            $toLower: '$aa_searchterms.term',
          },
        })
        .match({
          'aa_searchterms.term': {
            $in: results.map(({ term }) => term),
          },
        })
        .group({
          _id: '$aa_searchterms.term',
          clicks: {
            $sum: '$aa_searchterms.clicks',
          },
        })
        .project({
          _id: 0,
          term: '$_id',
          clicks: 1,
        })
        .exec()) || [];

    const prevResultsDict = arrayToDictionary(prevResults, 'term');

    return results.map((result) => {
      const prevClicks = prevResultsDict[result.term]?.clicks;
      const clicksChange =
        typeof prevClicks === 'number' && prevClicks !== 0
          ? Math.round(((result.clicks - prevClicks) / prevClicks) * 100) / 100
          : null;

      return {
        ...result,
        clicksChange,
      };
    });
  }
}

function aggregateSearchTermMetrics(dailyPageMetrics: PageMetrics[]) {
  const metricsBySearchTerm = dailyPageMetrics.reduce(
    (results, { gsc_searchterms }) => {
      for (const searchTermMetrics of gsc_searchterms) {
        if (!results[searchTermMetrics.term]) {
          (results[searchTermMetrics.term] as unknown) = {
            clicks: [],
            ctr: [],
            impressions: [],
            position: [],
          };
        }

        for (const metric of ['clicks', 'ctr', 'impressions', 'position']) {
          results[searchTermMetrics.term][metric].push(
            searchTermMetrics[metric],
          );
        }
      }

      return results;
    },
    {} as Record<string, Record<keyof GscSearchTermMetrics, number[]>>,
  );

  return Object.entries(metricsBySearchTerm).reduce(
    (results, [searchTerm, metrics]) => {
      const aggregatedMetrics = {
        clicks: metrics.clicks.reduce((sum, clicks) => sum + clicks, 0),
        ctr:
          metrics.ctr.reduce((sum, ctr) => sum + ctr, 0) / metrics.ctr.length,
        impressions: metrics.impressions.reduce(
          (sum, impressions) => sum + impressions,
          0,
        ),
        position:
          metrics.position.reduce((sum, position) => sum + position, 0) /
          metrics.position.length,
      };

      for (const key of Object.keys(aggregatedMetrics)) {
        aggregatedMetrics[key] = Math.round(aggregatedMetrics[key] * 100) / 100;
      }

      results[searchTerm] = {
        ...aggregatedMetrics,
        term: searchTerm,
      } as GscSearchTermMetrics;

      return results;
    },
    {} as Record<string, GscSearchTermMetrics>,
  );
}

function getSearchTermsWithPercentChange(
  searchTermMetrics: Record<string, GscSearchTermMetrics>,
  comparisonSearchTermMetrics: Record<string, GscSearchTermMetrics>,
): Record<string, GscSearchTermMetrics & { change: number }> {
  const uniqueSearchTerms = new Set([
    ...Object.keys(searchTermMetrics),
    ...Object.keys(comparisonSearchTermMetrics),
  ]);

  const searchTermsWithPercentChange: Record<
    string,
    GscSearchTermMetrics & { change: number }
  > = {};

  for (const searchTerm of uniqueSearchTerms) {
    const searchTermMetric = searchTermMetrics[searchTerm];
    const comparisonSearchTermMetric = comparisonSearchTermMetrics[searchTerm];

    if (searchTermMetric && comparisonSearchTermMetric) {
      const percentChange =
        (searchTermMetric.clicks - comparisonSearchTermMetric.clicks) /
        comparisonSearchTermMetric.clicks;

      searchTermsWithPercentChange[searchTerm] = {
        ...searchTermMetric,
        change: Math.round(percentChange * 100) / 100,
      };
    } else if (searchTermMetric) {
      searchTermsWithPercentChange[searchTerm] = {
        ...searchTermMetric,
        change: null,
      };
    }
  }

  return searchTermsWithPercentChange;
}

const getTop25SearchTerms = (
  searchTermsWithPercentChange: Record<
    string,
    GscSearchTermMetrics & { change: number }
  >,
) =>
  Object.values(searchTermsWithPercentChange)
    .sort(({ clicks: clicks1 }, { clicks: clicks2 }) => clicks2 - clicks1)
    .slice(0, 25);

const getTop5IncreaseSearchTerms = (
  searchTermsWithPercentChange: Record<
    string,
    GscSearchTermMetrics & { change: number }
  >,
) =>
  Object.values(searchTermsWithPercentChange)
    .sort(({ change: change1 }, { change: change2 }) => change2 - change1)
    .slice(0, 5);

const getTop5DecreaseSearchTerms = (
  searchTermsWithPercentChange: Record<
    string,
    GscSearchTermMetrics & { change: number }
  >,
) =>
  Object.values(searchTermsWithPercentChange)
    .sort(({ change: change1 }, { change: change2 }) => change1 - change2)
    .slice(0, 5);
