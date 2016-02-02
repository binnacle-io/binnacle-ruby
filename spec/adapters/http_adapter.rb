require 'http'
class HTTPAdapter < HTTPBaseAdapter
  def send_get_request
    HTTP.headers(@headers).get(parse_uri.to_s)
  end

  def send_post_request
    HTTP.headers(@headers).post(parse_uri.to_s, body: query_string)
  end

  def send_post_form_request
    HTTP.headers(@headers).post(parse_uri.to_s, form: @params)
  end
end
