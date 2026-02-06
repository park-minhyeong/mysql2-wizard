import express from "express";
import testService from "../service/test";
import consultAdminService from "../service/customer";

const defaultRouter = express.Router();

defaultRouter.get("/", async (req, res) => {
  const tests = await testService.read();
  return res.json({ tests, count: await testService.count() });
});

defaultRouter.post("/", async (req, res) => {
  const test = await testService.create(req.body);
  return res.json(test);
});

// search 기능 테스트용 라우터
defaultRouter.get("/search", async (req, res) => {
  try {
    const { search, page, pageSize } = req.query;

    // 쿼리 파라미터 파싱
    const searchParam = search ? String(search) : undefined;
    const pageParam = page ? parseInt(String(page), 10) : undefined;
    const pageSizeParam = pageSize ? parseInt(String(pageSize), 10) : undefined;

    // read 함수 호출 (search 파라미터 포함)
    const results = await consultAdminService.read({
      search: searchParam,
      page: pageParam,
      pageSize: pageSizeParam,
    });

    // count 함수 호출 (search 파라미터 포함)
    const totalCount = await consultAdminService.count({
      search: searchParam,
    });

    return res.json({
      success: true,
      data: results,
      count: totalCount,
      search: searchParam,
      page: pageParam,
      pageSize: pageSizeParam,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// search 기능 테스트용 - count만
defaultRouter.get("/search/count", async (req, res) => {
  try {
    const { search } = req.query;
    const searchParam = search ? String(search) : undefined;

    const count = await consultAdminService.count({
      search: searchParam,
    });

    return res.json({
      success: true,
      count,
      search: searchParam,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

export default defaultRouter;
