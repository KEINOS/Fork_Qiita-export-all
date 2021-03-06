"use strict";

const request = require("gaxios").request;
const URLSearchParams = require("url").URLSearchParams;
const parseRFC5988LinkHeader = require("parse-link-header");

/**
 * Qiita api wrapper
 */
class QiitaApi {
  /**
   * @param {string} token Qiita API access token
   * @param {boolean} debugFlag Enable debug log
   */
  constructor(token, debugFlag = false) {
    this.token_ = token;
    this.debugFlag_ = debugFlag;
    Object.freeze(this.token_);
    Object.freeze(this.debugFlag_);
    /** @type {number|undefined} */
    this.requestRemain = undefined;
    /** @type {number|undefined} */
    this.requestLimit = undefined;
  }

  /**
   * @param {string} url GET Request URL includes GET params
   * @returns {Promise<any[]>}
   */
  async GetAllData_(url) {
    const items = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const re = await request({
        url: url,
        headers: {
          "content-type": "application/json",
          charset: "utf-8",
          Authorization: `Bearer ${this.token_}`,
        },
        retryConfig: {
          retry: 4,
          retryDelay: 1000,
        },
        retry: true,
        responseType: "json",
      });
      this.requestRemain = re.headers["rate-remaining"];
      this.requestLimit = re.headers["rate-limit"];
      if (this.requestRemain <= 0) {
        throw new Error("API request limit exceeded. Retry 1h later.");
      }
      if (this.debugFlag_) {
        process.stdout.write(`debug: request limit remain: ${this.requestRemain}/${this.requestLimit}\x1B[0G`);
      }
      // append
      items.push(...Array.from(re.data));
      const link = parseRFC5988LinkHeader(re.headers.link);
      // when cannot find next page
      if (link.next == null || link.next.url == null) break;
      // set next url
      url = link.next.url;
    }
    return items;
  }

  /**
   * Get all user items
   * @param {string} target `/users/:user_id` or `authenticated_user`
   */
  async GetAllUserItemsImpl_(target) {
    const getParams = new URLSearchParams({ page: 1, per_page: 100 }).toString();
    return this.GetAllData_(`https://qiita.com/api/v2/${target}/items?${getParams}`);
  }

  /**
   * Get all user items
   * @param {string} userId qiita user id
   * @returns {Promise<any[]>}
   */
  async GetAllUserItems(userId) {
    return this.GetAllUserItemsImpl_(`users/${userId}`);
  }

  /**
   * Get all authenticated user items
   * @returns {Promise<any[]>}
   */
  async GetAllAuthenticatedUserItems() {
    return this.GetAllUserItemsImpl_("authenticated_user");
  }

  /**
   * Get all comment
   * @param {string} itemId target item id
   * @returns {Promise<any[]>}
   */
  async GetAllComments(itemId) {
    const getParams = new URLSearchParams({ page: 1, per_page: 100 }).toString();
    return this.GetAllData_(`https://qiita.com/api/v2/items/${itemId}/comments?${getParams}`);
  }
}

module.exports = QiitaApi;
