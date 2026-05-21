const TEMPLATE_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; }
      th, td { border: 1px solid #999; padding: 6px 10px; mso-number-format: "\\@"; }
    </style>
  </head>
  <body>
    <table>
      <thead>
        <tr>
          <th>申请人</th>
          <th>工号</th>
          <th>部门</th>
          <th>系统名称</th>
          <th>权限范围</th>
          <th>申请原因</th>
          <th>有效期</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>张三</td>
          <td>U0001</td>
          <td>业务运营部</td>
          <td>客户管理平台</td>
          <td>订单明细只读</td>
          <td>季度经营分析</td>
          <td>2026-05-21 至 2026-06-20</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`;

export async function GET() {
  const encodedFilename = encodeURIComponent('权限申请模板.xls');

  return new Response(TEMPLATE_HTML, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.ms-excel; charset=utf-8',
      'content-disposition': `attachment; filename="permission-request-template.xls"; filename*=UTF-8''${encodedFilename}`
    }
  });
}
