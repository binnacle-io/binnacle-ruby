require 'httparty'
class HTTPartyAdapter < HTTPBaseAdapter
  def send_get_request
    HTTParty.get(parse_uri.to_s, headers: @headers)
  end

  def send_post_request
    HTTParty.post(parse_uri.to_s, body: query_string, headers: @headers)
  end
end
