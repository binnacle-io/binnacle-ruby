require "ethon"
class EthonAdapter < HTTPBaseAdapter
  def send_get_request
    url = @data
    easy = Ethon::Easy.new
    easy.http_request(parse_uri.to_s, :get, { headers: @headers, params: @data })
    easy.perform
  end

  def send_post_request
    easy = Ethon::Easy.new
    easy.http_request(parse_uri.to_s, :post, { headers: @headers, body: query_string })
    easy.perform
  end

  def self.is_libcurl?
    true
  end
end